export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  let tone = "bg-secondary text-muted-foreground"; // default
  let displayLabel = status;

  if (["second chance"].includes(normalized)) {
    tone = "bg-amber-500/15 text-amber-700 border border-amber-300 animate-pulse";
    displayLabel = "Second Chance";
  } else if (["claimed", "in progress"].includes(normalized)) {
    tone = "bg-warning/20 text-warning-foreground";
  } else if (["delivered", "collected", "completed", "success"].includes(normalized)) {
    tone = "bg-success/15 text-[color:var(--success)]";
  } else if (["cancelled", "unclaimed", "failed"].includes(normalized)) {
    tone = "bg-destructive/15 text-destructive";
  } else if (["expired", "lapsed"].includes(normalized)) {
    tone = "bg-destructive/15 text-destructive";
    displayLabel = "Lapsed";
  } else if (["pending"].includes(normalized)) {
    tone = "bg-blue-100 text-blue-700";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {displayLabel}
    </span>
  );
}
