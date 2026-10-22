/**
 * ngo-claim-cooldown.ts
 *
 * Claim eligibility logic for NGO donation claiming.
 * All claim limits and rolling quotas have been removed for NGO accounts to empower organizations
 * to rescue as much surplus food as possible.
 */

export const MAX_DAILY_CLAIMS = Infinity;
export const MAX_CONCURRENT_ACTIVE_CLAIMS = Infinity;
export const NGO_CLAIM_COOLDOWN_MS = 0;

export interface ClaimEligibilityResult {
  canClaim: boolean;
  reason: "ok" | "daily_limit_reached" | "max_active_claims" | "urgent_exempt";
  claimsUsedToday: number;
  maxDailyClaims: number;
  cooldownUntil: Date | null;
}

export function evaluateNgoClaimEligibility(
  recentClaims?: { claimed_at: string | null; status: string }[],
  _batchCollectionDatetime?: string | null,
): ClaimEligibilityResult {
  return {
    canClaim: true,
    reason: "ok",
    claimsUsedToday: recentClaims ? recentClaims.length : 0,
    maxDailyClaims: Infinity,
    cooldownUntil: null,
  };
}

export function getNgoClaimCooldownEnd(_claimedAt?: string | null): Date | null {
  return null;
}

export function formatClaimAvailableAt(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
