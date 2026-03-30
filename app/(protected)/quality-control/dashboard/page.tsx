import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
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
import { Clock3 } from "lucide-react";

// Mock Data
const MOCK_SUPPLIERS = [
  { id: "1", name: "Global Ingredients Inc.", country: "USA", status: "Approved", pendingDocs: 0, expiringDocs: 1 },
  { id: "2", name: "Organic Farms Ltd.", country: "Canada", status: "Pending", pendingDocs: 2, expiringDocs: 0 },
  { id: "3", name: "NuTech Packaging", country: "Mexico", status: "Review Required", pendingDocs: 1, expiringDocs: 2 },
  { id: "4", name: "Alpha Botanicals", country: "Brazil", status: "Approved", pendingDocs: 0, expiringDocs: 0 },
];

const MOCK_DOCUMENTS = [
  { id: "d1", supplier: "Organic Farms Ltd.", type: "Kosher Certificate", status: "Pending Review", uploadedDate: "2026-03-29", expiryDate: "2027-03-29" },
  { id: "d2", supplier: "Global Ingredients Inc.", type: "ISO 9001", status: "Expiring Soon", uploadedDate: "2025-04-15", expiryDate: "2026-04-15" },
  { id: "d3", supplier: "NuTech Packaging", type: "BRCGS Certificate", status: "Expired", uploadedDate: "2024-03-01", expiryDate: "2025-03-01" },
  { id: "d4", supplier: "Alpha Botanicals", type: "Allergen Statement", status: "Approved", uploadedDate: "2026-01-10", expiryDate: "2027-01-10" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_SUPPLIERS.length}</div>
            <p className="text-xs text-muted-foreground">
              2 pending approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">3</div>
            <p className="text-xs text-muted-foreground">
              Documents waiting for approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon (30d)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">4</div>
            <p className="text-xs text-muted-foreground">
              Needs automated reminders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Compliant</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">85%</div>
            <p className="text-xs text-muted-foreground">
              Of required supplier matrix
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Document Activity</CardTitle>
            <CardDescription>
              Latest uploads and status changes across your supplier network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_DOCUMENTS.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.supplier}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>
                      <Badge variant={
                        doc.status === "Approved" ? "default" :
                        doc.status === "Pending Review" ? "outline" :
                        doc.status === "Expired" ? "destructive" : "secondary"
                      }>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Review <ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Action Items</CardTitle>
            <CardDescription>
              Tasks that require immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4 rounded-md border p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">Expired Certificate</p>
                <p className="text-sm text-muted-foreground">NuTech Packaging's BRCGS certificate expired on March 1st.</p>
              </div>
              <Button size="sm" variant="outline">Email</Button>
            </div>
            <div className="flex items-start space-x-4 rounded-md border p-4">
              <Clock3 className="mt-0.5 h-5 w-5 text-orange-500" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">Pending Approval</p>
                <p className="text-sm text-muted-foreground">Organic Farms uploaded a new Kosher cert.</p>
              </div>
              <Button size="sm">Review</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
