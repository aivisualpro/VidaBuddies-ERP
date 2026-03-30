"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { use } from "react";
export default function AppAdminSupplierLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const pathname = usePathname();
  const { id } = use(params);
  const activeTab = pathname.includes("/supply-survey") ? "supply-survey" : pathname.includes("/survey") ? "survey" : pathname.includes("/documents") ? "documents" : pathname.includes("/details") ? "details" : "dashboard";
  return (
    <div className="flex-1 flex flex-col pt-2">
      <div className="border-b sticky top-0 z-20 bg-background">
        <div className="flex h-10 items-center overflow-x-auto gap-2">
          <Link href={`/quality-control/suppliers/${id}/dashboard`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'dashboard' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Dashboard</Link>
          <Link href={`/quality-control/suppliers/${id}/documents`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'documents' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Documents</Link>
          <Link href={`/quality-control/suppliers/${id}/survey`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'survey' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Q&F Safety Survey</Link>
          <Link href={`/quality-control/suppliers/${id}/supply-survey`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'supply-survey' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Q&F Supply Survey</Link>
          <Link href={`/quality-control/suppliers/${id}/details`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'details' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Details & Locations</Link>
        </div>
      </div>
      <div className="flex-1 w-full h-full pb-0 pt-2">
        {children}
      </div>
    </div>
  );
}
