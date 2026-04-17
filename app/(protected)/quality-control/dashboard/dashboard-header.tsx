"use client";

import { useEffect } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Mail, Download, Users, Clock, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export default function DashboardHeader({ 
  totalSuppliers, 
  totalPending, 
  totalExpiring 
}: { 
  totalSuppliers: number, 
  totalPending: number, 
  totalExpiring: number 
}) {
  const { setRightContent } = useHeaderActions();

  useEffect(() => {
    setRightContent(
      <TooltipProvider>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2 bg-muted/30 px-3 py-1.5 rounded-full border">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{totalSuppliers}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Suppliers</TooltipContent>
            </Tooltip>
            
            <div className="w-px h-4 bg-border"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-600">{totalPending}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pending Reviews</TooltipContent>
            </Tooltip>
            
            <div className="w-px h-4 bg-border"></div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600">{totalExpiring}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Expiring Soon (30d)</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Mail className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] font-black uppercase tracking-widest bg-black text-white">
                Send Reminders
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] font-black uppercase tracking-widest bg-black text-white">
                Export Pre-Sales Pack
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );

    return () => {
      setRightContent(null);
    };
  }, [setRightContent, totalSuppliers, totalPending, totalExpiring]);

  return null;
}
