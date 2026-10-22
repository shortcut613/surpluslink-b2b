/**
 * impact-math.ts
 *
 * Unified impact and meal calculations across all dashboards in SurplusLink.
 * Uses standard South African food rescue benchmarks:
 *  - 1 nutritious meal = 350g (0.35 kg) of rescued food
 *  - R45 rescued food value per kg
 *  - 2.5 kg CO2e prevented per kg rescued
 */

export function itemToKg(quantity: number | string, unit?: string | null): number {
  const q = parseFloat(String(quantity).replace(/[^\d.]/g, "")) || 0;
  if (q <= 0) return 0;

  const u = (unit || "kg").toLowerCase().trim();

  switch (u) {
    case "ton":
    case "tonne":
    case "tons":
    case "tonnes":
      return q * 1000;
    case "g":
    case "gram":
    case "grams":
    case "ml":
      return q * 0.001;
    case "pallet":
    case "pallets":
      return q * 200;
    case "crate":
    case "crates":
    case "box":
    case "boxes":
    case "bag":
    case "bags":
      return q * 10;
    case "item":
    case "items":
    case "unit":
    case "units":
    case "pack":
    case "packs":
    case "loaf":
    case "loaves":
    case "can":
    case "cans":
    case "meal":
    case "meals":
      return q * 0.4;
    case "kg":
    case "l":
    case "liter":
    case "liters":
    case "litre":
    case "litres":
    default:
      return q * 1;
  }
}

export interface BatchImpactResult {
  totalKg: number;
  totalMeals: number;
  totalValueZar: number;
  totalCo2Kg: number;
}

export function calculateBatchImpact(
  items: { quantity: number | string; unit?: string | null; category?: string | null }[],
): BatchImpactResult {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      totalKg: 0,
      totalMeals: 0,
      totalValueZar: 0,
      totalCo2Kg: 0,
    };
  }

  let totalKg = 0;
  for (const item of items) {
    totalKg += itemToKg(item.quantity, item.unit);
  }

  totalKg = Number(totalKg.toFixed(2));
  const totalMeals = Math.round(totalKg / 0.35);
  const totalValueZar = Math.round(totalKg * 45);
  const totalCo2Kg = Number((totalKg * 2.5).toFixed(1));

  return {
    totalKg,
    totalMeals,
    totalValueZar,
    totalCo2Kg,
  };
}
