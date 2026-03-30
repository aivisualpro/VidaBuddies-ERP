import { SupplierDashboard } from "@/components/supplier-portal/SupplierDashboard";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDashboard supplierId={id} isSupplierView={true} />;
}
