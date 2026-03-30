import { redirect } from "next/navigation";
export default async function SupplierRootRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quality-control/suppliers/${id}/dashboard`);
}
