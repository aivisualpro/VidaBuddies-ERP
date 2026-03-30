import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, FileText, Filter } from "lucide-react";
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

const MOCK_DOCUMENTS = [
  { id: "d1", supplier: "Organic Farms Ltd.", type: "Kosher Certificate", status: "Pending Review", uploadedDate: "2026-03-29", expiryDate: "2027-03-29" },
  { id: "d2", supplier: "Global Ingredients Inc.", type: "ISO 9001", status: "Expiring Soon", uploadedDate: "2025-04-15", expiryDate: "2026-04-15" },
  { id: "d3", supplier: "NuTech Packaging", type: "BRCGS Certificate", status: "Expired", uploadedDate: "2024-03-01", expiryDate: "2025-03-01" },
  { id: "d4", supplier: "Alpha Botanicals", type: "Allergen Statement", status: "Approved", uploadedDate: "2026-01-10", expiryDate: "2027-01-10" },
];

export default function DocumentsPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Approval Workflow</CardTitle>
            <CardDescription>
              Review uploaded documents, approve, reject, and monitor expirations.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" /> Filter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Type</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date Uploaded</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_DOCUMENTS.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground"/>
                    {doc.type}
                  </div>
                </TableCell>
                <TableCell>{doc.supplier}</TableCell>
                <TableCell>{doc.uploadedDate}</TableCell>
                <TableCell>
                    <span className={doc.status === "Expired" ? "text-red-600 font-medium" : ""}>
                      {doc.expiryDate}
                    </span>
                </TableCell>
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
                  {doc.status === "Pending Review" ? (
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" className="text-green-600 h-8 w-8 hover:bg-green-50"><CheckCircle2 className="h-4 w-4"/></Button>
                      <Button size="icon" variant="ghost" className="text-red-600 h-8 w-8 hover:bg-red-50"><XCircle className="h-4 w-4"/></Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm">Details</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
