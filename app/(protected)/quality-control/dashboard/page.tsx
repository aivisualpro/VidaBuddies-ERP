import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, ShieldCheck, ArrowRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const compliancePercentage = totalDocsCount > 0 ? Math.round((totalApproved / totalDocsCount) * 100) : 0;

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">
              {suppliersWithPending} with pending reviews
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalPending}</div>
            <p className="text-xs text-muted-foreground">
              Documents waiting for approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon (30d)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalExpiring}</div>
            <p className="text-xs text-muted-foreground">
              Missing or expiring documents
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Health</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{compliancePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              Of uploaded documents approved
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle>Supplier Compliance Overview</CardTitle>
            <CardDescription>
              Status of all suppliers across the network.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Total Docs</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Expiring/Expired</TableHead>
                  <TableHead className="text-right">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supp: any) => {
                  let sTotal = 0;
                  let sPending = 0;
                  let sExp = 0;
                  let sApproved = 0;
                  
                  if (Array.isArray(supp.documents)) {
                    supp.documents.forEach((doc: IVidaSupplierDocument) => {
                      if (doc.isNA) return;
                      if (doc.fileId || doc.fileLink || doc.logs?.length > 0) {
                        sTotal++;
                        let expDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
                        if (expDate && expDate <= thirtyDaysFromNow) {
                          sExp++;
                        } else if (!doc.isVerified) {
                          sPending++;
                        } else {
                          sApproved++;
                        }
                      }
                    });
                  }
                  
                  const sHealth = sTotal > 0 ? Math.round((sApproved / sTotal) * 100) : 0;
                  
                  return (
                    <TableRow key={supp._id}>
                      <TableCell className="font-medium">
                        <Link href={`/quality-control/suppliers/${supp._id}/documents`} className="hover:underline flex flex-col">
                          <span>{supp.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">{supp.vbId}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">{sTotal}</TableCell>
                      <TableCell className="text-center">
                        {sPending > 0 ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">{sPending}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {sExp > 0 ? (
                          <Badge variant="outline" className="text-destructive border-red-200 bg-red-50">{sExp}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {sTotal === 0 ? (
                          <span className="text-muted-foreground text-sm">No Docs</span>
                        ) : (
                          <Badge variant={sHealth === 100 ? "default" : "secondary"} className={sHealth === 100 ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                            {sHealth}%
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 flex flex-col">
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
