
"use client";

import { useState } from "react";
import { 
  FileCheck, 
  AlertTriangle, 
  Clock, 
  Users, 
  FileText, 
  Mail, 
  ShieldCheck, 
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock3,
  Download
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock Data representing the Quality Control state
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

const MOCK_MATRIX = [
  { supplier: "Global Ingredients Inc.", kosher: "Approved", iso: "Expiring", brc: "N/A", allergen: "Approved" },
  { supplier: "Organic Farms Ltd.", kosher: "Pending", iso: "Approved", brc: "Approved", allergen: "Missing" },
  { supplier: "NuTech Packaging", kosher: "N/A", iso: "Approved", brc: "Expired", allergen: "Approved" },
  { supplier: "Alpha Botanicals", kosher: "Approved", iso: "Approved", brc: "Approved", allergen: "Approved" },
];

export default function QualityControlPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quality Control</h2>
          <p className="text-muted-foreground">
            Supplier document control, expiry reminders, and approval workflow.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Mail className="mr-2 h-4 w-4" /> Send Reminders
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export Pre-Sales Pack
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Master</TabsTrigger>
          <TabsTrigger value="documents">Document Library & Approvals</TabsTrigger>
          <TabsTrigger value="matrix">Required Doc Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Master List</CardTitle>
              <CardDescription>
                Unified database with supplier details and top-level approval status.
              </CardDescription>
              <div className="flex w-full max-w-sm items-center space-x-2 pt-2">
                <Input type="text" placeholder="Search suppliers..." />
                <Button type="submit" variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Country/Site</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead>Pending Actions</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_SUPPLIERS.map((sup) => (
                    <TableRow key={sup.id}>
                      <TableCell className="font-medium">{sup.name}</TableCell>
                      <TableCell>{sup.country}</TableCell>
                      <TableCell>
                        <Badge variant={sup.status === "Approved" ? "default" : "outline"}>
                          {sup.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {sup.pendingDocs > 0 && <span className="text-orange-500">{sup.pendingDocs} pending reviews</span>}
                          {sup.expiringDocs > 0 && <span className="text-red-500">{sup.expiringDocs} expiring/expired</span>}
                          {sup.pendingDocs === 0 && sup.expiringDocs === 0 && <span className="text-muted-foreground">Up to date</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View Profile</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
