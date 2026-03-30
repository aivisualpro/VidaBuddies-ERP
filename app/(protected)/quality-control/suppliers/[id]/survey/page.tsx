import { SupplierSurvey } from "@/components/supplier-portal/SupplierSurvey";
export default async function AdminSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierSurvey supplierId={id} isSupplierView={false} templateId="qfs-manufacturing-survey" tabLabel="Q&F SAFETY SURVEY" />;
}
