"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useEffect, useState } from "react";

export function SupplierDashboard({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const { setLeftContent } = useHeaderActions();
  const [supplierName, setSupplierName] = useState<string>("");
  const [metrics, setMetrics] = useState({
    total: 40,
    completed: 0,
    missing: 40,
    completionPercentage: 0,
    status: "MISSING DOCUMENTS",
  });

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const response = await fetch(`/api/admin/suppliers/${supplierId}`);
        if (response.ok) {
          const data = await response.json();
          setSupplierName(data.name || "");
          
          let comp = 0;
          if (data.documents) {
            data.documents.forEach((d: any) => {
              if (d.fileId) comp++;
            });
          }
          const miss = 40 - comp;
          setMetrics({
            total: 40,
            completed: comp,
            missing: miss,
            completionPercentage: Math.round((comp / 40) * 100),
            status: miss > 0 ? "MISSING DOCUMENTS" : "COMPLIANT"
          });
        }
      } catch (error) {
        console.error("Failed to fetch supplier details:", error);
      }
    };
    fetchSupplier();
  }, [supplierId]);

  useEffect(() => {
    if (supplierName) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          {supplierName} <span className="text-primary/40">/ DASHBOARD</span>
        </h1>
      );
    }
  }, [supplierName, setLeftContent]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completed (Yes)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-500">{metrics.completed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Missing (No)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-500">{metrics.missing}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-black tracking-tight mt-2">
              {metrics.missing > 0 ? (
                <span className="text-orange-500 flex items-center gap-2">⚠️ {metrics.status}</span>
              ) : (
                <span className="text-green-500 flex items-center gap-2"><CheckCircle className="h-4 w-4"/> COMPLIANT</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Compliance Progress</CardTitle>
          <CardDescription className="text-xs font-medium uppercase tracking-wider">Overall document submission completion rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
            <span className="text-primary">Completion %</span>
            <span className="text-muted-foreground">{metrics.completionPercentage}%</span>
          </div>
          <Progress value={metrics.completionPercentage} className="h-3" />
        </CardContent>
      </Card>
    </div>
  );
}
