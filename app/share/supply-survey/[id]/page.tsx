import { SupplierSurvey } from "@/components/supplier-portal/SupplierSurvey";

export default async function PublicSupplySurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 md:p-8">
      {/* Dynamic background effect similar to login for style points */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] sm:top-[-20%] left-[-10%] h-[300px] sm:h-[500px] w-[300px] sm:w-[500px] rounded-full bg-primary/20 blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-[-10%] sm:bottom-[-20%] right-[-10%] h-[300px] sm:h-[500px] w-[300px] sm:w-[500px] rounded-full bg-primary/10 blur-[80px] sm:blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto shadow-2xl rounded-xl">
        <SupplierSurvey supplierId={id} isSupplierView={true} templateId="qfs-supply-survey" tabLabel="Q&F SUPPLY SURVEY" />
      </div>
    </div>
  );
}
