import { SupplierDocumentsGrid } from "@/components/supplier-portal/SupplierDocumentsGrid";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDocumentsGrid supplierId={id} />;
}
