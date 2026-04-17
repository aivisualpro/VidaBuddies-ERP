"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useEffect } from "react";
import { Mail, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export default function QualityControlLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setLeftContent, setRightContent } = useHeaderActions();

  // If path is deep (like /suppliers/123), don't show the generic tabs
  const isDeepRoute = pathname.split('/').length > 3;

  useEffect(() => {
    if (!isDeepRoute) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Quality Control
        </h1>
      );
      
      const activeTab = pathname.includes("/suppliers") ? "suppliers" : "dashboard";
      
      if (activeTab !== "dashboard") {
        setRightContent(null);
      }
    } else {
      setRightContent(null);
    }
  }, [setLeftContent, setRightContent, isDeepRoute, pathname]);

  const activeTab = pathname.includes("/suppliers") ? "suppliers" 
                  : "dashboard";

  return (
    <div className="flex-1 flex flex-col gap-0 h-full overflow-hidden">
      {!isDeepRoute && (
        <div className="border-b sticky top-0 bg-background z-20 shrink-0">
          <div className="flex h-10 items-center overflow-x-auto">
            <Link 
              href="/quality-control/dashboard" 
              className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors hover:text-primary ${activeTab === 'dashboard' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}
            >
              Dashboard
            </Link>
            <Link 
              href="/quality-control/suppliers" 
              className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors hover:text-primary ${activeTab === 'suppliers' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}
            >
              Supplier Master
            </Link>
          </div>
        </div>
      )}
      
      {activeTab === 'suppliers' && !isDeepRoute ? (
        <div className="flex-1 overflow-hidden rounded-xl bg-card border shadow-sm mt-4">
          <div className="h-full overflow-y-auto w-full">
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
