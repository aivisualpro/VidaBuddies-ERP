import { SupplierSurvey } from "@/components/supplier-portal/SupplierSurvey";
export default async function SupplySurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierSurvey supplierId={id} isSupplierView={true} templateId="qfs-supply-survey" tabLabel="Q&F SUPPLY SURVEY" />;
}
