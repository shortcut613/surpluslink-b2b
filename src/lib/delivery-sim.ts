/**
 * delivery-sim.ts
 *
 * Pure utility — no DOM or Maps dependency.
 * Provides deterministic driver data and a time-based progress formula
 * that mimics an Uber-style live delivery without any real courier API.
 */

// ── Seeded PRNG (Mulberry32) ───────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

// ── Driver data pools ──────────────────────────────────────────────────────
const NAMES = [
  "Sipho Dlamini",
  "Thabo Nkosi",
  "Amara Osei",
  "Kagiso Sithole",
  "Lerato Mokoena",
  "Nomvula Zulu",
  "Bongani Khumalo",
  "Ayanda Ntuli",
  "Zanele Motsepe",
  "Mpho Masondo",
];
const VEHICLES = [
  "Toyota Hilux",
  "Ford Ranger",
  "VW Transporter",
  "Isuzu D-Max",
  "Mercedes Sprinter",
  "Nissan NV350",
];
const PROVINCES = ["GP", "WC", "EC", "NW", "FS", "MP", "LP", "KZN"];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ── Types ──────────────────────────────────────────────────────────────────
export type DeliveryPhase = "preparing" | "en_route" | "nearby" | "delivered";

export interface SimulatedDriver {
  name: string;
  vehicle: string;
  rating: number;
  plate: string;
  initials: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a deterministic, simulated driver for a given batch ID.
 * Reloading the page with the same batch always yields the same driver.
 */
export function getSimulatedDriver(batchId: string): SimulatedDriver {
  const rng = mulberry32(strToSeed(batchId));

  const name = NAMES[Math.floor(rng() * NAMES.length)];
  const vehicle = VEHICLES[Math.floor(rng() * VEHICLES.length)];
  const province = PROVINCES[Math.floor(rng() * PROVINCES.length)];
  const num = Math.floor(rng() * 900) + 100;
  const L1 = ALPHA[Math.floor(rng() * 26)];
  const L2 = ALPHA[Math.floor(rng() * 26)];
  const rating = Math.round((3.8 + rng() * 1.2) * 10) / 10;

  return {
    name,
    vehicle,
    rating,
    plate: `${num} ${L1}${L2} ${province}`,
    initials: name
      .split(" ")
      .map((w) => w[0])
      .join(""),
  };
}

/** Simulated delivery cap — 3 min (for live demo). */
const SIM_DURATION_MS = 3 * 60 * 1000;

/**
 * Computes how far along the simulated delivery is based on wall-clock
 * time elapsed since `claimedAt`, capped at SIM_DURATION_MS.
 */
export function getDeliveryProgress(
  claimedAt: string | null,
  collectionDatetime: string | null,
): { progress: number; etaMinutes: number; phase: DeliveryPhase } {
  if (!claimedAt) {
    return { progress: 0, etaMinutes: 3, phase: "preparing" };
  }

  const start = new Date(claimedAt).getTime();
  const elapsed = Date.now() - start;

  // If the real pickup window is shorter than 45 min, use that instead
  let total = SIM_DURATION_MS;
  if (collectionDatetime) {
    const window = new Date(collectionDatetime).getTime() - start;
    if (window > 0 && window < SIM_DURATION_MS) total = window;
  }

  const progress = Math.min(Math.max(elapsed / total, 0), 1);
  const remaining = Math.max(total - elapsed, 0);
  const etaMinutes = Math.ceil(remaining / 60_000);

  const phase: DeliveryPhase =
    progress >= 1
      ? "delivered"
      : progress >= 0.8
        ? "nearby"
        : progress >= 0.05
          ? "en_route"
          : "preparing";

  return { progress, etaMinutes, phase };
}
