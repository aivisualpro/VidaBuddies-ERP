import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, ShieldCheck, ArrowRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { REQUIRED_DOCS } from "@/lib/supplier-docs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import connectToDatabase from "@/lib/db";
import VidaSupplier, { IVidaSupplierDocument } from "@/lib/models/VidaSupplier";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import DashboardHeader from "./dashboard-header";

export const revalidate = 0; // Ensure data is always fresh

export default async function DashboardPage() {
  await connectToDatabase();
  const suppliers = await VidaSupplier.find({}).lean();

  let totalPending = 0;
  let totalExpiring = 0;
  let totalApproved = 0;
  let totalDocsCount = 0;
  let suppliersWithPending = 0;

  type DocActivity = {
    id: string;
    supplierId: string;
    supplierName: string;
    type: string;
    status: string;
    statusText: string;
    date: Date;
  };

  const allActivities: DocActivity[] = [];
  const actionItems: DocActivity[] = [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  suppliers.forEach((supp: any) => {
    let suppPending = false;

    if (Array.isArray(supp.documents)) {
      supp.documents.forEach((doc: IVidaSupplierDocument) => {
        if (doc.isNA) return; // Skip N/A documents

        // Only consider documents that have been acted upon (uploaded)
        if (doc.fileId || doc.fileLink || doc.logs?.length > 0) {
          totalDocsCount++;
          
          let statusStr = "approved";
          let statusText = "Approved";
          let actDate = doc.logs?.length > 0 ? new Date(doc.logs[doc.logs.length - 1].date) : new Date();

          let expDate = doc.expiryDate ? new Date(doc.expiryDate) : null;

          if (expDate && expDate < now) {
            statusStr = "expired";
            statusText = "Expired";
            totalExpiring++; // Count expired as needing attention
          } else if (expDate && expDate <= thirtyDaysFromNow) {
            statusStr = "expiring_soon";
            statusText = "Expiring Soon";
            totalExpiring++;
          } else if (!doc.isVerified) {
            statusStr = "pending";
            statusText = "Pending Review";
            totalPending++;
            suppPending = true;
          } else {
            totalApproved++;
          }

          const activityEntry = {
            id: `${supp._id}_${doc.name.replace(/\s+/g, '_')}`,
            supplierId: supp._id.toString(),
            supplierName: supp.name,
            type: doc.name,
            status: statusStr,
            statusText: statusText,
            date: actDate
          };

          allActivities.push(activityEntry);

          if (statusStr === "expired" || statusStr === "expiring_soon" || statusStr === "pending") {
            actionItems.push(activityEntry);
          }
        }
      });
    }

    if (suppPending) suppliersWithPending++;
  });

  // Sort activities newest first
  allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  // Action items priority: Expired first, then Pending, then Expiring Soon. 
  // For simplicity, just sort action items by date ascending (oldest pending/expired first)
  actionItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  const recentDocs = allActivities.slice(0, 10);
  const topActionItems = actionItems.slice(0, 5);
  return (
    <div className="flex-1 h-full pt-4 flex flex-col overflow-hidden">
      <DashboardHeader 
        totalSuppliers={suppliers.length} 
        totalPending={totalPending} 
        totalExpiring={totalExpiring} 
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 flex-1 min-h-0">
        <Card className="col-span-4 flex flex-col h-full overflow-hidden border-b-0 rounded-b-none">
          <CardHeader>
            <CardTitle>Supplier Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 overflow-hidden [&_[data-slot=table-container]]:flex-1 [&_[data-slot=table-container]]:overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-20 shadow-sm [&_th]:bg-card text-xs">
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Uploaded</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                  <TableHead className="text-center">Remaining</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supp: any) => {
                  const isOrganic = !!supp.isOrganic;
                  const effectiveDocs = isOrganic ? REQUIRED_DOCS : REQUIRED_DOCS.filter(d => d.category !== 'Organic Certificate');
                  const supplierDocs = supp.documents || [];
                  const naDocs = supplierDocs.filter((d: any) => d.isNA).map((d: any) => d.name);
                  const applicableDocs = effectiveDocs.filter(d => !naDocs.includes(d.name));
                  const totalApplicable = applicableDocs.length;
                  
                  let uploaded = 0;
                  let verified = 0;
                  
                  applicableDocs.forEach(reqDoc => {
                    const sDoc = supplierDocs.find((d: any) => d.name === reqDoc.name);
                    if (sDoc && ((sDoc.files && sDoc.files.length > 0) || sDoc.fileId)) {
                      uploaded += 1;
                    }
                    if (sDoc && ((sDoc.files && sDoc.files.some((f: any) => f.isVerified)) || sDoc.isVerified)) {
                      verified += 1;
                    }
                  });

                  const remaining = totalApplicable - uploaded;
                  const progress = totalApplicable > 0 ? Math.round((uploaded / totalApplicable) * 100) : 100;
                  
                  return (
                    <TableRow key={supp._id}>
                      <TableCell>
                        <Link href={`/quality-control/suppliers/${supp._id}/documents`} className="hover:underline font-medium">
                          {supp.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground font-medium">{uploaded}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-blue-500 font-medium">{verified}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-xs">{remaining}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-medium w-8 text-right">{progress}%</span>
                          <div className="w-16">
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 flex flex-col h-full overflow-hidden border-b-0 rounded-b-none">
          <CardHeader>
            <CardTitle>Action Items</CardTitle>
            <CardDescription>
              Tasks that require immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 overflow-auto">
            {topActionItems.length > 0 ? topActionItems.map(item => (
              <div key={`action_${item.id}`} className="flex items-start space-x-4 rounded-md border p-4 shadow-sm bg-accent/30">
                {item.status === 'expired' ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
                ) : item.status === 'pending' ? (
                  <Clock3 className="mt-0.5 h-5 w-5 text-orange-500 shrink-0" />
                ) : (
                  <Clock className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
                )}
                
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-sm font-semibold leading-none truncate">
                    {item.status === 'expired' ? 'Expired Certificate' : item.status === 'pending' ? 'Pending Approval' : 'Expiring Soon'}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.supplierName}'s {item.type} {item.status === 'expired' ? 'has expired' : item.status === 'pending' ? 'needs verification' : 'is expiring soon'} 
                    {item.date ? ` (${formatDistanceToNow(item.date, { addSuffix: true })})` : ''}.
                  </p>
                </div>
                
                <Button size="sm" variant={item.status === 'expired' ? "outline" : "default"} asChild>
                  <Link href={`/quality-control/suppliers/${item.supplierId}/documents`}>
                    {item.status === 'pending' ? 'Review' : 'View'}
                  </Link>
                </Button>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center space-y-2">
                <ShieldCheck className="h-8 w-8 text-emerald-500/50" />
                <p>All caught up!<br/>No action items right now.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
