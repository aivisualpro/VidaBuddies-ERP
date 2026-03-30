import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOCK_MATRIX = [
  { supplier: "Global Ingredients Inc.", kosher: "Approved", iso: "Expiring", brc: "N/A", allergen: "Approved" },
  { supplier: "Organic Farms Ltd.", kosher: "Pending", iso: "Approved", brc: "Approved", allergen: "Missing" },
  { supplier: "NuTech Packaging", kosher: "N/A", iso: "Approved", brc: "Expired", allergen: "Approved" },
  { supplier: "Alpha Botanicals", kosher: "Approved", iso: "Approved", brc: "Approved", allergen: "Approved" },
];

export default function MatrixPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Required Document Matrix</CardTitle>
            <CardDescription>
              Bird's-eye view of missing, expired, and completed documents per supplier.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Supplier</TableHead>
                <TableHead className="text-center">Kosher Cert.</TableHead>
                <TableHead className="text-center">ISO 9001</TableHead>
                <TableHead className="text-center">BRCGS</TableHead>
                <TableHead className="text-center">Allergen Statement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_MATRIX.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.supplier}</TableCell>
                  {[row.kosher, row.iso, row.brc, row.allergen].map((status, idx) => (
                    <TableCell key={idx} className="text-center">
                      {status === "Approved" && <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">Valid</Badge>}
                      {status === "Pending" && <Badge variant="outline" className="text-orange-600 border-orange-200">Pending</Badge>}
                      {status === "Expiring" && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400">Expiring</Badge>}
                      {status === "Expired" && <Badge variant="destructive">Expired</Badge>}
                      {status === "Missing" && <Badge variant="outline" className="border-red-200 text-red-600">Missing</Badge>}
                      {status === "N/A" && <span className="text-muted-foreground text-xs">N/A</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
