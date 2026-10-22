export function Field({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors
          ${
            error
              ? "border-destructive focus:ring-destructive focus:border-destructive"
              : "border-input focus:border-ring focus:ring-ring"
          }`}
      />
      {error && <p className="text-[11px] text-destructive leading-tight">{error}</p>}
    </div>
  );
}
