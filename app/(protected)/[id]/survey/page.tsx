import { SupplierSurvey } from "@/components/supplier-portal/SupplierSurvey";
export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierSurvey supplierId={id} isSupplierView={true} templateId="qfs-manufacturing-survey" tabLabel="Q&F SAFETY SURVEY" />;
}
