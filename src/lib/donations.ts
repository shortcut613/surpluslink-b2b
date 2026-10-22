import { supabase } from "@/lib/supabase";
import { sendPushNotification, notifyNGOsOfNewDonation } from "./notifications";

export type DonationItem = {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  expiry: string;
};

export type RecentDonation = {
  id: number;
  batchId: string;
  category: string;
  time: string;
  status: string;
  submittedAt: string;
  collectionDateTime?: string;
  collectionType?: string | null;
  items: DonationItem[];
};

const CURRENT_BATCH_KEY = "surpluslink-current-donation-batch";

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "An unexpected error occurred.";
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function formatDonationTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
  if (sameDay) return `Today, ${clock}`;
  if (isYesterday) return `Yesterday, ${clock}`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
}

function getEarliestExpiry(items: DonationItem[]): Date | null {
  const expiries = items
    .map((item) => new Date(item.expiry))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (expiries.length === 0) return null;

  return new Date(Math.min(...expiries.map((date) => date.getTime())));
}

function getEarliestExpiryDate(items: DonationItem[]): string | null {
  const expiryDates = items
    .map((item) => item.expiry?.split("T")[0])
    .filter((date): date is string => Boolean(date));

  return expiryDates.length > 0 ? expiryDates.sort()[0] : null;
}

function pruneExpiredRecentDonations(donations: RecentDonation[]): RecentDonation[] {
  const now = new Date();

  return donations.filter((donation) => {
    const earliestExpiry = getEarliestExpiry(donation.items);
    if (!earliestExpiry) {
      return true;
    }
    return earliestExpiry.getTime() > now.getTime();
  });
}

interface RawDonationItemRow {
  id: string;
  name: string;
  category: string;
  quantity: number | string;
  unit: string;
  expiry: string;
}

function mapItemRow(row: RawDonationItemRow): DonationItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: String(row.quantity),
    unit: row.unit,
    expiry: row.expiry,
  };
}

interface RawBatchRow {
  id: string;
  display_id?: number;
  batch_type?: string;
  submitted_at?: string;
  status?: string;
  collection_datetime?: string;
  collection_type?: string | null;
  donation_items?: RawDonationItemRow[];
}

export function mapBatchRow(row: RawBatchRow): RecentDonation {
  // display_id is a generated sequence column; fall back to a stable
  // numeric hash of the UUID so formatBatchId never receives undefined.
  const displayId =
    typeof row.display_id === "number"
      ? row.display_id
      : Math.abs(
          String(row.id)
            .split("")
            .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0),
        ) % 1000;
  return {
    id: displayId,
    batchId: row.id,
    category: row.batch_type ?? "Donation",
    time: row.submitted_at ? formatDonationTime(row.submitted_at) : "—",
    status: row.status ?? "Pending",
    submittedAt: row.submitted_at ?? "",
    collectionDateTime: row.collection_datetime,
    collectionType: row.collection_type ?? null,
    items: (row.donation_items ?? []).map(mapItemRow),
  };
}

export function loadCurrentBatch(): DonationItem[] {
  if (typeof window === "undefined") return [];
  return safeParse<DonationItem[]>(window.localStorage.getItem(CURRENT_BATCH_KEY), []);
}

export function saveCurrentBatch(items: DonationItem[]) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(items);
  window.localStorage.setItem(CURRENT_BATCH_KEY, json);
  // Notify other tabs that the in-progress batch changed
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CURRENT_BATCH_KEY,
        newValue: json,
        storageArea: window.localStorage,
      }),
    );
  } catch {
    // StorageEvent dispatch is best-effort
  }
}

export function clearCurrentBatch() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CURRENT_BATCH_KEY);
}

export function makeItemId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export async function submitDonationBatch(
  items: DonationItem[],
  batchType: string, // Changed parameter name to match review component usage
  collectionDateTime: string,
  submittedAt: string,
): Promise<RecentDonation> {
  const earliestExpiryDate = getEarliestExpiryDate(items);
  const collectionDate = collectionDateTime.split("T")[0];
  if (earliestExpiryDate && collectionDate > earliestExpiryDate) {
    throw new Error("The collection date must be on or before the earliest item expiry date.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("You must be signed in to submit a donation.");
  }

  // Fallback category detection context if batchType text comes in blank
  let computedBatchType = batchType;
  if (!computedBatchType) {
    const allCategories = items.flatMap((item) =>
      item.category ? item.category.split(", ").map((c) => c.trim()) : [],
    );
    const uniqueCategories = Array.from(new Set(allCategories)).filter(Boolean);
    computedBatchType =
      uniqueCategories.length > 1 ? "Mixed Donation" : uniqueCategories[0] || "Donation";
  }

  // Ensure the user has a row in the donors table (satisfies the FK constraint).
  // This is a no-op for existing donors; it only inserts on first donation.
  // The DB trigger `handle_new_user` should create this row on signup — this
  // is a safety-net for accounts created before the trigger existed.
  const userMeta = userData.user.user_metadata ?? {};
  const { error: upsertError } = await supabase.from("donors").upsert(
    {
      id: userData.user.id,
      organization_name: userMeta.business_name ?? userMeta.organization_name ?? "Unknown Donor",
      address: userMeta.address ?? "",
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    // RLS may block this upsert for users whose donor row was created by the
    // DB trigger (which runs as SECURITY DEFINER). Check if the row already
    // exists before treating this as a hard failure.
    const { data: existingDonor } = await supabase
      .from("donors")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!existingDonor) {
      // Donor row truly doesn't exist and we can't create it — surface this clearly.
      console.error("[donations] donors upsert failed and row not found:", upsertError);
      throw new Error(
        "Your donor profile could not be found. Please sign out, sign back in, and try again.",
      );
    }
    // Row exists — RLS just blocked the upsert write. Safe to continue.
    console.warn(
      "[donations] donors upsert blocked by RLS (row already exists, continuing):",
      upsertError.message,
    );
  }

  // Perform parent batch insert
  const { data: batchRow, error: batchError } = await supabase
    .from("donation_batches")
    .insert({
      donor_id: userData.user.id,
      batch_type: computedBatchType,
      collection_datetime: collectionDateTime || null,
      submitted_at: submittedAt,
      status: "unclaimed",
    })
    .select()
    .single();

  if (batchError || !batchRow) {
    console.error("[donations] Batch insert error:", batchError);
    throw new Error("Failed to submit your donation. Please try again.");
  }

  // 4. Map and batch save your line items
  const itemRows = items.map((item) => ({
    batch_id: batchRow.id,
    name: item.name,
    category: item.category,
    quantity: parseFloat(String(item.quantity).replace(/[^\d.]/g, "")) || 1,
    unit: item.unit || "kg",
    expiry: item.expiry || null,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("donation_items")
    .insert(itemRows)
    .select();

  if (itemsError) {
    console.error("[donations] Items insert error:", itemsError);
    throw new Error("Failed to save donation items. Please try again.");
  }

  // Fire and forget push notification to the donor
  sendPushNotification({
    data: {
      userId: userData.user.id,
      payload: {
        title: "Donation Received!",
        body: `Your batch ${batchRow.batch_type} has been listed. You'll be notified when an NGO claims it.`,
        url: "/donor/dashboard",
      },
    },
  }).catch((err: any) => console.error("Push failed:", err));

  // Also broadcast to all verified NGOs so they know about the new donation
  notifyNGOsOfNewDonation({
    data: {
      batchType: batchRow.batch_type,
      batchId: batchRow.id,
    },
  }).catch(console.error);

  clearCurrentBatch();
  return mapBatchRow({ ...batchRow, donation_items: insertedItems });
}

export async function relistDonationBatch(
  batchId: string | number,
  additionalHours: number = 24,
): Promise<RecentDonation | null> {
  const { data: batch, error } = await supabase
    .from("donation_batches")
    .select("*, donation_items(*)")
    .eq("id", batchId)
    .single();

  if (error || !batch) {
    throw new Error("Batch not found or failed to load.");
  }

  const items: DonationItem[] = (batch.donation_items ?? []).map(mapItemRow);
  const earliestExpiry = getEarliestExpiry(items);

  if (earliestExpiry && earliestExpiry.getTime() <= Date.now()) {
    throw new Error(
      "This batch cannot be relisted as Second Chance because the food items have already expired.",
    );
  }

  let targetDeadline = new Date(Date.now() + additionalHours * 3600 * 1000);

  if (earliestExpiry && earliestExpiry.getTime() > Date.now()) {
    if (targetDeadline > earliestExpiry) {
      targetDeadline = earliestExpiry;
    }
  }

  const newDeadline = targetDeadline.toISOString();

  const { data: updatedBatch, error: updateError } = await supabase
    .from("donation_batches")
    .update({
      status: "Second Chance",
      collection_datetime: newDeadline,
    })
    .eq("id", batchId)
    .select("*, donation_items(*)")
    .single();

  if (updateError || !updatedBatch) {
    throw new Error("Failed to relist batch.");
  }

  notifyNGOsOfNewDonation({
    data: {
      batchType: `Second Chance: ${updatedBatch.batch_type || "Surplus Food"}`,
      batchId: updatedBatch.id,
    },
  }).catch(console.error);

  return mapBatchRow(updatedBatch);
}

export async function loadRecentDonations(): Promise<RecentDonation[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from("donation_batches")
    .select("*, donation_items(*)")
    .eq("donor_id", userData.user.id)
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const now = new Date();
  for (const batch of data) {
    const statusLower = (batch.status || "").toLowerCase();
    if (
      ["pending", "unclaimed", "second chance"].includes(statusLower) &&
      batch.collection_datetime
    ) {
      const collectionDate = new Date(batch.collection_datetime);
      if (collectionDate < now) {
        const items = (batch.donation_items ?? []).map(mapItemRow);
        const earliestExpiry = getEarliestExpiry(items);
        const isStillFresh = earliestExpiry && earliestExpiry.getTime() > now.getTime();
        const newStatus = isStillFresh ? "Second Chance" : "Unclaimed";

        if (batch.status !== newStatus) {
          const { error: updateError } = await supabase
            .from("donation_batches")
            .update({ status: newStatus })
            .eq("id", batch.id);

          if (!updateError) {
            batch.status = newStatus;
            sendPushNotification({
              data: {
                userId: userData.user.id,
                payload: {
                  title: isStillFresh
                    ? "Listing Extended: Second Chance 🔄"
                    : "Listing Unclaimed ⚠️",
                  body: isStillFresh
                    ? `Your listing for ${batch.batch_type || "Surplus Food"} passed its pickup window but items are still fresh. Marked as Second Chance!`
                    : `Your listing for ${batch.batch_type || "Surplus Food"} was not claimed before the collection deadline.`,
                  url: `/donor/dashboard`,
                },
              },
            }).catch((err) => console.error("Push failed:", err));
          }
        }
      }
    }
  }

  // Show all recent batches regardless of item expiry — the donor
  // should always see their own submissions on the dashboard.
  return data.map(mapBatchRow);
}

export async function loadAllDonations(): Promise<RecentDonation[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from("donation_batches")
    .select("*, donation_items(*)")
    .eq("donor_id", userData.user.id)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const now = new Date();
  for (const batch of data) {
    const statusLower = (batch.status || "").toLowerCase();
    if (
      ["pending", "unclaimed", "second chance"].includes(statusLower) &&
      batch.collection_datetime
    ) {
      const collectionDate = new Date(batch.collection_datetime);
      if (collectionDate < now) {
        const items = (batch.donation_items ?? []).map(mapItemRow);
        const earliestExpiry = getEarliestExpiry(items);
        const isStillFresh = earliestExpiry && earliestExpiry.getTime() > now.getTime();
        const newStatus = isStillFresh ? "Second Chance" : "Unclaimed";

        if (batch.status !== newStatus) {
          const { error: updateError } = await supabase
            .from("donation_batches")
            .update({ status: newStatus })
            .eq("id", batch.id);

          if (!updateError) {
            batch.status = newStatus;
            sendPushNotification({
              data: {
                userId: userData.user.id,
                payload: {
                  title: isStillFresh
                    ? "Listing Extended: Second Chance 🔄"
                    : "Listing Unclaimed ⚠️",
                  body: isStillFresh
                    ? `Your listing for ${batch.batch_type || "Surplus Food"} passed its pickup window but items are still fresh. Marked as Second Chance!`
                    : `Your listing for ${batch.batch_type || "Surplus Food"} was not claimed before the collection deadline.`,
                  url: `/donor/dashboard`,
                },
              },
            }).catch((err) => console.error("Push failed:", err));
          }
        }
      }
    }
  }

  return data.map(mapBatchRow);
}

export async function updateDonationStatus(
  identifier: string | number,
  status: string,
): Promise<RecentDonation | null> {
  const query = supabase.from("donation_batches").update({ status }).select("*, donation_items(*)");

  const { data, error } = await (
    typeof identifier === "number" ? query.eq("display_id", identifier) : query.eq("id", identifier)
  ).single();

  if (error || !data) return null;
  return mapBatchRow(data);
}
