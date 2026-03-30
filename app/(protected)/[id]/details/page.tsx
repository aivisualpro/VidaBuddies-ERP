import { SupplierDetails } from "@/components/supplier-portal/SupplierDetails";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetails supplierId={id} isSupplierView={true} />;
}
