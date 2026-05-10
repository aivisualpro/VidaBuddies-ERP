"use client";

export function AvatarStack({
  users,
  max = 3,
}: {
  users: { id: string; name: string; avatar?: string }[];
  max?: number;
}) {
  const shown = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <div
          key={u.id}
          className="h-6 w-6 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary overflow-hidden"
          title={u.name}
        >
          {u.avatar ? (
            <img
              src={u.avatar}
              alt={u.name}
              className="h-full w-full object-cover"
            />
          ) : (
            u.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
