import { IconClock } from "@tabler/icons-react";

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <IconClock className="h-12 w-12 text-primary" />
      </div>
      <h1 className="text-3xl font-black uppercase tracking-tight mb-3">Coming Soon</h1>
      <p className="text-muted-foreground max-w-md">
        This module is currently under development. Stay tuned for exciting new features to empower your operations!
      </p>
    </div>
  );
}
