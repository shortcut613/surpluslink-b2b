import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import { DatePicker } from "@/components/ScrollPicker";
import { loadCurrentBatch, makeItemId, saveCurrentBatch, type DonationItem } from "@/lib/donations";

import { useAuth } from "@/hooks/useAuth";

interface BatchItem extends DonationItem {
  status: "Active" | "Expired";
}

interface DraftState {
  name: string;
  categories: string[];
  quantity: string;
  unit: string;
  expiry: string;
}

const CATEGORIES = [
  "Produce",
  "Bakery",
  "Dairy",
  "Prepared Meals",
  "Canned Goods",
  "Meat",
  "Beverages",
  "Snacks",
];

const DEFAULT_FOOD_TYPES = [
  "Whole Grain Bread",
  "Fresh Apples / Fruit",
  "Assorted Vegetables",
  "Pasteurized Milk",
  "Canned Beans & Soups",
  "Cooked Rice & Meals",
  "Fresh Poultry / Meat",
  "Bottled Water / Juice",
  "Packaged Snacks",
  "Other / Mixed Surplus",
];

const SAVED_TYPES_KEY = "surpluslink_saved_food_types";

const EMPTY_DRAFT: DraftState = {
  name: "",
  categories: [],
  quantity: "",
  unit: "kg",
  expiry: "",
};

function getItemStatus(expiry: string): "Active" | "Expired" {
  if (!expiry) return "Active";
  return expiry.split("T")[0] < new Date().toISOString().split("T")[0] ? "Expired" : "Active";
}

function loadSavedTypes(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_TYPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedTypes(types: string[]) {
  localStorage.setItem(SAVED_TYPES_KEY, JSON.stringify(types));
}

function StatusBadge({ status }: { status: "Active" | "Expired" }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border
      ${
        status === "Expired"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      }`}
    >
      {status}
    </span>
  );
}

function CategorySelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(cat: string) {
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="ml-1 text-xs font-bold uppercase text-muted-foreground">Category</label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200
              ${
                selected.includes(cat)
                  ? "scale-[1.03] border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

function FoodTypeInput({
  value,
  onChange,
  savedTypes,
  onSave,
  onDelete,
}: {
  value: string;
  onChange: (v: string) => void;
  savedTypes: string[];
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const allTypes = [...savedTypes, ...DEFAULT_FOOD_TYPES.filter((d) => !savedTypes.includes(d))];

  const q = query.toLowerCase();
  const filteredSaved = savedTypes.filter((t) => !q || t.toLowerCase().includes(q));
  const filteredDefaults = DEFAULT_FOOD_TYPES.filter(
    (d) => !savedTypes.includes(d) && (!q || d.toLowerCase().includes(q)),
  );

  const isNew =
    query.trim().length > 0 &&
    !allTypes.some((t) => t.toLowerCase() === query.trim().toLowerCase());
  const isAlreadySaved = savedTypes.some((t) => t.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function select(t: string) {
    setQuery(t);
    onChange(t);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
      <label className="ml-1 text-xs font-bold uppercase text-muted-foreground">Food Type</label>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type or select a food type..."
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {isNew && (
          <button
            type="button"
            onClick={() => {
              onSave(query.trim());
              setOpen(false);
            }}
            className="whitespace-nowrap rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
          >
            + Save
          </button>
        )}
      </div>

      {open && (filteredSaved.length > 0 || filteredDefaults.length > 0) && (
        <ul className="absolute top-full z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-input bg-card py-1 shadow-md">
          {filteredSaved.length > 0 && (
            <>
              <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your saved types
              </li>
              {filteredSaved.map((t) => (
                <li
                  key={t}
                  className="group flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary"
                >
                  <button type="button" className="flex-1 text-left" onMouseDown={() => select(t)}>
                    {t}
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onDelete(t);
                      if (query === t) {
                        setQuery("");
                        onChange("");
                      }
                    }}
                    className="ml-2 opacity-0 text-muted-foreground transition-all hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </>
          )}

          {filteredDefaults.length > 0 && (
            <>
              <li className="mt-1 border-t px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Default types
              </li>
              {filteredDefaults.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                    onMouseDown={() => select(t)}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      {isNew && (
        <p className="ml-1 text-xs text-muted-foreground">
          New food type — click "+ Save" to add it to your list.
        </p>
      )}
      {isAlreadySaved && (
        <p className="ml-1 text-xs text-[color:var(--success)]">✓ Saved to your personal list</p>
      )}
    </div>
  );
}

function BatchItemRow({ item, onRemove }: { item: BatchItem; onRemove: () => void }) {
  return (
    <li className="group flex items-center justify-between py-3 text-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{item.name}</p>
          <StatusBadge status={item.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.category.split(", ").map((c) => (
            <span
              key={c}
              className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mr-3 text-right">
        <p className="font-semibold">
          {item.quantity} {item.unit || "kg"}
        </p>
        {item.expiry && (
          <p
            className={`text-[10px] ${item.status === "Expired" ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            Exp: {item.expiry.split("T")[0]}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        title="Remove item"
        className="rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

export const Route = createFileRoute("/donor/donate/batch")({
  head: () => ({ meta: [{ title: "Create Donation Batch — SurplusLink" }] }),
  component: CreateBatch,
});

function CreateBatch() {
  const navigate = useNavigate();
  const { initials } = useAuth();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [savedTypes, setSavedTypes] = useState<string[]>([]);
  const [dateKey, setDateKey] = useState(0);

  useEffect(() => {
    setSavedTypes(loadSavedTypes());
    const stored = loadCurrentBatch() as BatchItem[];
    if (stored.length > 0) {
      setItems(stored.map((item) => ({ ...item, status: getItemStatus(item.expiry) })));
    }
  }, []);

  // Persist batch on every change
  useEffect(() => {
    saveCurrentBatch(items);
  }, [items]);

  // Cross-tab sync: if another tab updates the batch, reload it here
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "surpluslink-current-donation-batch" && e.newValue) {
        try {
          const synced = JSON.parse(e.newValue) as BatchItem[];
          setItems(synced.map((item) => ({ ...item, status: getItemStatus(item.expiry) })));
        } catch {
          /* ignore parse errors */
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSaveType = useCallback((name: string) => {
    setSavedTypes((prev) => {
      const updated = [name, ...prev.filter((t) => t !== name)];
      persistSavedTypes(updated);
      return updated;
    });
  }, []);

  const handleDeleteType = useCallback((name: string) => {
    setSavedTypes((prev) => {
      const updated = prev.filter((t) => t !== name);
      persistSavedTypes(updated);
      return updated;
    });
  }, []);

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  const canAdd =
    draft.name.trim().length > 0 && draft.categories.length > 0 && Number(draft.quantity) > 0;

  function handleAddItem() {
    if (!canAdd) return;

    const newItem: BatchItem = {
      id: makeItemId(),
      name: draft.name.trim(),
      category: draft.categories.join(", "),
      quantity: draft.quantity,
      unit: draft.unit || "kg",
      expiry: draft.expiry,
      status: getItemStatus(draft.expiry),
    };

    setItems((prev) => [...prev, newItem]);
    setDraft(EMPTY_DRAFT);
    setDateKey((k) => k + 1);
  }

  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/donor/dashboard"
          className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to Dashboard
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          Add individual items to your current batch before submitting.
        </p>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Item Details</h2>

          <div className="space-y-5">
            <FoodTypeInput
              value={draft.name}
              onChange={(name) => updateDraft({ name })}
              savedTypes={savedTypes}
              onSave={handleSaveType}
              onDelete={handleDeleteType}
            />

            <CategorySelector
              selected={draft.categories}
              onChange={(categories) => updateDraft({ categories })}
            />

            <div className="flex flex-col gap-1.5">
              <label className="ml-1 text-xs font-bold uppercase text-muted-foreground">
                Quantity & Unit
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={draft.quantity}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d.]/g, "");
                    updateDraft({ quantity: clean });
                  }}
                  placeholder="e.g. 10"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={draft.unit || "kg"}
                  onChange={(e) => updateDraft({ unit: e.target.value })}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {["kg", "g", "L", "items", "boxes", "crates", "pallets"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="ml-1 text-xs font-bold uppercase text-muted-foreground">
                Expiry (optional)
              </label>
              <DatePicker
                key={dateKey}
                value={draft.expiry}
                onChange={(expiry) => updateDraft({ expiry })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            disabled={!canAdd}
            className="mt-6 w-full rounded-md border border-dashed border-primary/50 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Item to Batch
          </button>
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">Items in this batch ({items.length})</h2>

          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No items added yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <BatchItemRow
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 flex justify-between gap-4">
          <Link
            to="/donor/dashboard"
            className="rounded-md border px-6 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Cancel
          </Link>
          <button
            onClick={() => navigate({ to: "/donor/donate/review" })}
            disabled={items.length === 0}
            className="flex-1 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Finish & Review Batch
          </button>
        </div>
      </main>
    </>
  );
}
