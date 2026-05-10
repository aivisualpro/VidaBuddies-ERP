"use client";

export function DaySeparator({ dateStr }: { dateStr: string }) {
  const label = getLabel(dateStr);
  return (
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function getLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
