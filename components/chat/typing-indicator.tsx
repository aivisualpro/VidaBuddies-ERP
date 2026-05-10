"use client";

export function TypingIndicator({
  users,
}: {
  users: { userId: string; name: string }[];
}) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0].name} is typing`
      : users.length === 2
      ? `${users[0].name} and ${users[1].name} are typing`
      : `${users[0].name} and ${users.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2">
      <div className="flex items-center gap-1 bg-muted/60 px-4 py-2.5 rounded-2xl rounded-bl-sm">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground italic">
        {text}
      </span>
    </div>
  );
}
