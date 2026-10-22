import { useEffect, useState, useMemo, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/* ─── Helpers ─── */

export function generateDates(maxDate?: string) {
  const dates: Date[] = [];
  const today = new Date();
  const latestDate = maxDate ? new Date(`${maxDate}T00:00:00`) : null;
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    if (latestDate && d > latestDate) break;
    dates.push(d);
  }
  return dates;
}

export function formatDateLabel(d: Date) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/* ─── Scroll Column ─── */

function ScrollColumn({
  items,
  selected,
  onChange,
  renderItem,
}: {
  items: number[] | Date[];
  selected: number;
  onChange: (idx: number) => void;
  renderItem: (item: any, isSelected: boolean) => string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(v, items.length - 1));
  const touchStartY = useRef<number | null>(null);
  const lastChanged = useRef<number>(0);
  const [isEngaged, setIsEngaged] = useState(false);

  // Lock page scroll without hiding scrollbar
  useEffect(() => {
    if (!isEngaged) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("wheel", prevent, { passive: false });
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.removeEventListener("wheel", prevent);
      document.removeEventListener("touchmove", prevent);
    };
  }, [isEngaged]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsEngaged(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.touches[0].clientY;
    const now = Date.now();
    if (Math.abs(dy) > 20 && now - lastChanged.current > 80) {
      onChange(clamp(selected + (dy > 0 ? 1 : -1)));
      touchStartY.current = e.touches[0].clientY;
      lastChanged.current = now;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
    setIsEngaged(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      onChange(clamp(selected + 1));
    } else if (e.deltaY < 0) {
      onChange(clamp(selected - 1));
    }
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 touch-none rounded-lg px-2 py-1 transition-all duration-200
        ${isEngaged ? "scale-110 bg-muted/60 shadow-md" : "hover:scale-105 hover:bg-muted/40"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseEnter={() => setIsEngaged(true)}
      onMouseLeave={() => setIsEngaged(false)}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(selected - 1))}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
        <span className="text-xs text-muted-foreground/40 h-5 leading-5 select-none">
          {selected > 0 ? renderItem(items[selected - 1], false) : ""}
        </span>
        <span className="text-sm font-bold text-foreground h-7 leading-7 select-none">
          {renderItem(items[selected], true)}
        </span>
        <span className="text-xs text-muted-foreground/40 h-5 leading-5 select-none">
          {selected < items.length - 1 ? renderItem(items[selected + 1], false) : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(clamp(selected + 1))}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Calendar Date Picker ─── */

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initDate = useMemo(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }, []);

  // "day" = main calendar, "month-year" = month/year picker, "closed" = locked-in pill
  const [view, setView] = useState<"day" | "month-year" | "closed">(initDate ? "closed" : "day");
  const [viewYear, setViewYear] = useState(initDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate?.getMonth() ?? today.getMonth());
  const [pickYear, setPickYear] = useState(initDate?.getFullYear() ?? today.getFullYear());
  const [selected, setSelected] = useState<Date | null>(initDate);

  const cells = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const openMonthYearPicker = () => {
    setPickYear(viewYear);
    setView("month-year");
  };
  const selectMonthYear = (month: number) => {
    setViewYear(pickYear);
    setViewMonth(month);
    setView("day");
  };

  const handleDayClick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    if (d < today) return;
    setSelected(d);
  };

  const handleApply = () => {
    if (!selected) return;
    setView("closed");
    onChange(toISODate(selected));
  };

  const handleClear = () => {
    setSelected(null);
    setView("day");
    onChange("");
  };

  const handleEdit = () => {
    setView("day");
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long" });
  const lockedLabel = selected
    ? selected.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden w-full max-w-xs transition-all duration-300">
      {/* ── CLOSED: locked-in pill ── */}
      {view === "closed" && selected && (
        <div className="flex items-center gap-3 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Checkmark badge */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-[color:var(--success)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          {/* Date label */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Expiry locked in
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{lockedLabel}</p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEdit}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Change date"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Clear date"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── MONTH-YEAR PICKER view ── */}
      {view === "month-year" && (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          {/* Year navigation */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <button
              type="button"
              onClick={() => setPickYear((y) => y - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Previous year"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-foreground tabular-nums">{pickYear}</span>
            <button
              type="button"
              onClick={() => setPickYear((y) => y + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Next year"
            >
              ›
            </button>
          </div>
          {/* 3×4 month grid */}
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4">
            {MONTH_NAMES.map((m, idx) => {
              const isCurrent = idx === viewMonth && pickYear === viewYear;
              const isThisMonth = idx === today.getMonth() && pickYear === today.getFullYear();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMonthYear(idx)}
                  className={[
                    "rounded-lg py-2 text-sm font-medium transition-all duration-150",
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isThisMonth
                        ? "border border-primary/40 text-foreground hover:bg-secondary"
                        : "text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {/* Back link */}
          <div className="border-t px-3 py-2.5">
            <button
              type="button"
              onClick={() => setView("day")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3 w-3"
              >
                <path
                  fillRule="evenodd"
                  d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
              Back to calendar
            </button>
          </div>
        </div>
      )}

      {/* ── DAY GRID view ── */}
      {view === "day" && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Previous month"
            >
              ‹
            </button>
            {/* Clickable month+year heading */}
            <button
              type="button"
              onClick={openMonthYearPicker}
              className="group flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              title="Jump to month & year"
            >
              {monthName} {viewYear}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              cellDate.setHours(0, 0, 0, 0);
              const isPast = cellDate < today;
              const isToday = cellDate.getTime() === today.getTime();
              const isSelected = selected && cellDate.getTime() === selected.getTime();

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDayClick(day)}
                  className={[
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-150",
                    isPast
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : isSelected
                        ? "bg-primary text-primary-foreground shadow-sm scale-110"
                        : isToday
                          ? "border border-primary/40 text-foreground hover:bg-primary hover:text-primary-foreground"
                          : "text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: hint + Apply */}
          <div className="border-t px-3 py-3 flex items-center gap-2">
            {selected ? (
              <span className="flex-1 text-xs text-muted-foreground">
                {selected.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="flex-1 text-xs text-muted-foreground italic">Pick a day above</span>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={!selected}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Engaged Wrapper (pop-out + scroll lock for custom columns) ─── */

function EngagedWrapper({
  children,
  onChange,
}: {
  children: React.ReactNode;
  onChange: (direction: number) => void;
}) {
  const [isEngaged, setIsEngaged] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const lastChanged = useRef<number>(0);

  useEffect(() => {
    if (!isEngaged) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("wheel", prevent, { passive: false });
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.removeEventListener("wheel", prevent);
      document.removeEventListener("touchmove", prevent);
    };
  }, [isEngaged]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsEngaged(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.touches[0].clientY;
    const now = Date.now();
    if (Math.abs(dy) > 20 && now - lastChanged.current > 80) {
      onChange(dy > 0 ? 1 : -1);
      touchStartY.current = e.touches[0].clientY;
      lastChanged.current = now;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
    setIsEngaged(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) onChange(1);
    else if (e.deltaY < 0) onChange(-1);
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 touch-none rounded-lg px-2 py-1 transition-all duration-200
        ${isEngaged ? "scale-110 bg-muted/60 shadow-md" : "hover:scale-105 hover:bg-muted/40"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseEnter={() => setIsEngaged(true)}
      onMouseLeave={() => setIsEngaged(false)}
    >
      {children}
    </div>
  );
}

/* ─── Date + Time Picker ─── */

function getNowParts() {
  const now = new Date();
  let h = now.getHours();
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  const m = Math.ceil(now.getMinutes() / 5) * 5;
  // If minutes rounded up to 60, bump hour
  if (m >= 60) {
    return {
      hour: h === 12 ? 1 : h + 1,
      minute: 0,
      period: (h === 11 ? (period === "AM" ? "PM" : "AM") : period) as "AM" | "PM",
    };
  }
  return { hour: h, minute: m, period };
}

function to24(hour12: number, period: "AM" | "PM") {
  let h = hour12;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
}

export function DateTimePicker({
  value,
  onChange,
  maxDate,
}: {
  value: string;
  onChange: (v: string) => void;
  maxDate?: string;
}) {
  const dates = useMemo(() => generateDates(maxDate), [maxDate]);
  const todayIdx = 0;
  const nowParts = useMemo(() => getNowParts(), []);

  const parsed = useMemo(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        let h = d.getHours();
        const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        const foundIdx = dates.findIndex((dd) => dd.toDateString() === d.toDateString());
        return {
          dateIdx: foundIdx >= 0 ? foundIdx : todayIdx,
          hourIdx: HOURS.indexOf(h),
          minuteIdx: MINUTES.indexOf(Math.round(d.getMinutes() / 5) * 5),
          period,
        };
      }
    }
    // Default to current time
    return {
      dateIdx: todayIdx,
      hourIdx: HOURS.indexOf(nowParts.hour),
      minuteIdx: MINUTES.indexOf(nowParts.minute),
      period: nowParts.period,
    };
  }, []);

  const [dateIdx, setDateIdx] = useState(parsed.dateIdx >= 0 ? parsed.dateIdx : todayIdx);
  const [hourIdx, setHourIdx] = useState(parsed.hourIdx >= 0 ? parsed.hourIdx : 0);
  const [minuteIdx, setMinuteIdx] = useState(parsed.minuteIdx >= 0 ? parsed.minuteIdx : 0);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);

  const isToday = dateIdx === 0;
  const nowH24 = to24(nowParts.hour, nowParts.period);

  // Filter hours: on Today, only show hours >= current hour (in 24h), mapped back to 12h
  const availableHours = useMemo(() => {
    if (!isToday) return HOURS;
    return HOURS.filter((h) => {
      const h24AM = h === 12 ? 0 : h;
      const h24PM = h === 12 ? 12 : h + 12;
      // Keep this hour if either AM or PM version is >= now
      return h24AM >= nowH24 || h24PM >= nowH24;
    });
  }, [isToday, nowH24]);

  // Filter periods: on Today, check if AM is still valid
  const canAM = useMemo(() => {
    if (!isToday) return true;
    // AM is valid if current time is still AM
    return nowParts.period === "AM";
  }, [isToday, nowParts.period]);

  // Filter minutes: on Today + same hour + same period, only show minutes >= current minute
  const selectedH24 = to24(HOURS[hourIdx] ?? nowParts.hour, period);
  const availableMinutes = useMemo(() => {
    if (!isToday) return MINUTES;
    if (selectedH24 > nowH24) return MINUTES;
    // Same hour as now — only future minutes
    return MINUTES.filter((m) => m >= nowParts.minute);
  }, [isToday, selectedH24, nowH24, nowParts.minute]);

  // Clamp selections when constraints change
  useEffect(() => {
    if (isToday) {
      // Clamp period
      if (!canAM && period === "AM") {
        setPeriod("PM");
        return;
      }
      // Clamp hour
      const currentHour = HOURS[hourIdx];
      if (currentHour && !availableHours.includes(currentHour)) {
        setHourIdx(HOURS.indexOf(availableHours[0]));
        return;
      }
      // Clamp minute
      const currentMinute = MINUTES[minuteIdx];
      if (currentMinute !== undefined && !availableMinutes.includes(currentMinute)) {
        setMinuteIdx(MINUTES.indexOf(availableMinutes[0]));
      }
    }
  }, [isToday, canAM, period, hourIdx, minuteIdx, availableHours, availableMinutes]);

  // Emit value
  useEffect(() => {
    const d = dates[dateIdx];
    if (!d) return;
    const h24 = to24(HOURS[hourIdx] ?? nowParts.hour, period);
    const iso = `${toISODate(d)}T${String(h24).padStart(2, "0")}:${String(MINUTES[minuteIdx] ?? 0).padStart(2, "0")}`;
    onChange(iso);
  }, [dateIdx, hourIdx, minuteIdx, period]);

  // Handlers that respect constraints
  const setHourClamped = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, HOURS.length - 1));
    if (isToday && !availableHours.includes(HOURS[clamped])) return;
    setHourIdx(clamped);
  };

  const setMinuteClamped = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, MINUTES.length - 1));
    if (isToday && !availableMinutes.includes(MINUTES[clamped])) return;
    setMinuteIdx(clamped);
  };

  const togglePeriod = () => {
    const next = period === "AM" ? "PM" : "AM";
    if (isToday && next === "AM" && !canAM) return;
    setPeriod(next);
  };

  // Render helpers — dim unavailable items
  const renderHour = (h: number) => {
    return String(h);
  };
  const isHourDimmed = (h: number) => isToday && !availableHours.includes(h);

  const renderMinute = (m: number) => {
    return String(m).padStart(2, "0");
  };
  const isMinuteDimmed = (m: number) => isToday && !availableMinutes.includes(m);

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-4 gap-2 place-items-center">
        <ScrollColumn
          items={dates}
          selected={dateIdx}
          onChange={setDateIdx}
          renderItem={(d: Date) => formatDateLabel(d)}
        />
        {/* Hours */}
        <EngagedWrapper onChange={(dir) => setHourClamped(hourIdx + dir)}>
          <button
            type="button"
            onClick={() => setHourClamped(hourIdx - 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
            <span
              className={`text-xs h-5 leading-5 select-none ${hourIdx > 0 && !isHourDimmed(HOURS[hourIdx - 1]) ? "text-muted-foreground/40" : "text-transparent"}`}
            >
              {hourIdx > 0 ? renderHour(HOURS[hourIdx - 1]) : ""}
            </span>
            <span className="text-sm font-bold text-foreground h-7 leading-7 select-none">
              {renderHour(HOURS[hourIdx])}
            </span>
            <span
              className={`text-xs h-5 leading-5 select-none ${hourIdx < HOURS.length - 1 && !isHourDimmed(HOURS[hourIdx + 1]) ? "text-muted-foreground/40" : "text-transparent"}`}
            >
              {hourIdx < HOURS.length - 1 ? renderHour(HOURS[hourIdx + 1]) : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHourClamped(hourIdx + 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </EngagedWrapper>
        {/* Minutes */}
        <EngagedWrapper onChange={(dir) => setMinuteClamped(minuteIdx + dir)}>
          <button
            type="button"
            onClick={() => setMinuteClamped(minuteIdx - 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
            <span
              className={`text-xs h-5 leading-5 select-none ${minuteIdx > 0 && !isMinuteDimmed(MINUTES[minuteIdx - 1]) ? "text-muted-foreground/40" : "text-transparent"}`}
            >
              {minuteIdx > 0 ? renderMinute(MINUTES[minuteIdx - 1]) : ""}
            </span>
            <span className="text-sm font-bold text-foreground h-7 leading-7 select-none">
              {renderMinute(MINUTES[minuteIdx])}
            </span>
            <span
              className={`text-xs h-5 leading-5 select-none ${minuteIdx < MINUTES.length - 1 && !isMinuteDimmed(MINUTES[minuteIdx + 1]) ? "text-muted-foreground/40" : "text-transparent"}`}
            >
              {minuteIdx < MINUTES.length - 1 ? renderMinute(MINUTES[minuteIdx + 1]) : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMinuteClamped(minuteIdx + 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </EngagedWrapper>
        {/* AM/PM Toggle */}
        <EngagedWrapper onChange={() => togglePeriod()}>
          <button
            type="button"
            onClick={togglePeriod}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
            <span
              className={`text-xs h-5 leading-5 select-none ${canAM || period === "PM" ? "text-muted-foreground/40" : "text-transparent"}`}
            >
              {period === "AM" ? "" : "AM"}
            </span>
            <span className="text-sm font-bold text-foreground h-7 leading-7 select-none">
              {period}
            </span>
            <span className="text-xs text-muted-foreground/40 h-5 leading-5 select-none">
              {period === "PM" ? "" : "PM"}
            </span>
          </div>
          <button
            type="button"
            onClick={togglePeriod}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </EngagedWrapper>
      </div>
    </div>
  );
}
