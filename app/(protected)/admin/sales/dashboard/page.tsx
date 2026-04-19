"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconClipboardList, 
  IconTruckDelivery, 
  IconUserQuestion, 
  IconTrophy, 
  IconPackageExport, 
  IconPlus, 
  IconCopy, 
  IconExchange, 
  IconUserPlus, 
  IconBuildingStore, 
  IconUpload,
  IconUsers,
  IconBuildingWarehouse,
  IconTag,
  IconArrowUpRight,
  IconAlertTriangle,
  IconClock
} from "@tabler/icons-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from "recharts";

const MONTHLY_TREND = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 2000 },
  { name: 'Apr', revenue: 2780 },
  { name: 'May', revenue: 1890 },
  { name: 'Jun', revenue: 2390 },
  { name: 'Jul', revenue: 3490 },
];

const TOP_CUSTOMERS = [
  { name: "Acme Corp", revenue: "$145,000", change: "+12%" },
  { name: "Globex Inc", revenue: "$98,000", change: "+5%" },
  { name: "Soylent Corp", revenue: "$65,000", change: "-2%" },
  { name: "Initech", revenue: "$45,000", change: "+18%" },
];

const REP_LEADERBOARD = [
  { name: "Sarah Connor", sales: 45, revenue: "$450k", avatar: "SC" },
  { name: "John Smith", sales: 38, revenue: "$380k", avatar: "JS" },
  { name: "Mike Johnson", sales: 32, revenue: "$310k", avatar: "MJ" },
  { name: "Emma Davis", sales: 28, revenue: "$280k", avatar: "ED" },
];

const MARGIN_AT_RISK = [
  { quote: "QT-2024-089", customer: "Acme Corp", margin: "8%", risk: "High", value: "$45,000" },
  { quote: "QT-2024-102", customer: "Globex Inc", margin: "11%", risk: "Medium", value: "$12,500" },
  { quote: "QT-2024-115", customer: "Initech", margin: "9%", risk: "High", value: "$89,000" },
];

const EXPIRING_QUOTES = [
  { id: "QT-001", client: "Stark Industries", value: "$120k", expires: "2 days" },
  { id: "QT-002", client: "Wayne Enterprises", value: "$85k", expires: "3 days" },
  { id: "QT-003", client: "Oscorp", value: "$15k", expires: "5 days" },
];

export default function SalesDashboardPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions(null);
  }, [setActions]);

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* 1. KEY METRIC TILES */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <Card className="shadow-sm border-l-4 border-l-blue-500 overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col items-start gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <IconClipboardList size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Open Quotes</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">142</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-orange-500 overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col items-start gap-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/50 rounded-xl text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
              <IconTruckDelivery size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Awaiting Freight</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">28</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500 overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col items-start gap-4">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <IconUserQuestion size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Awaiting Customer</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">56</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500 overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col items-start gap-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <IconTrophy size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Won This Month</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">45</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-slate-500 overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col items-start gap-4">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform">
              <IconPackageExport size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Delivered Not Invoiced</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">12</h3>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 2. MIDDLE BLOCK: Trend & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend */}
        <Card className="lg:col-span-2 shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle>Monthly Sales Trend</CardTitle>
            <CardDescription>Revenue trajectory over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MONTHLY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(val) => `$${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Favorites Stack */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="pb-3 border-b border-black/5 dark:border-white/5">
              <CardTitle className="text-base flex items-center justify-between">
                Quick Actions
                <IconPlus size={16} className="text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x divide-y divide-black/5 dark:divide-white/5 border-b border-black/5 dark:border-white/5">
                <Link href="/admin/sales/quote-builder?new=true" className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconPlus size={20} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">New Quote</span>
                </Link>
                <button className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconCopy size={20} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Duplicate</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconExchange size={20} className="text-zinc-400 group-hover:text-amber-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Convert Won</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconUserPlus size={20} className="text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">New Customer</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconBuildingStore size={20} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">New Supplier</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <IconUpload size={20} className="text-zinc-400 group-hover:text-purple-500 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Upload Doc</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border flex-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">Favorites</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col gap-2">
               <Button variant="outline" className="w-full justify-start h-10 font-medium">
                 <IconUsers size={16} className="mr-2 text-blue-500" /> Team
               </Button>
               <Button variant="outline" className="w-full justify-start h-10 font-medium">
                 <IconBuildingStore size={16} className="mr-2 text-emerald-500" /> Customer
               </Button>
               <Button variant="outline" className="w-full justify-start h-10 font-medium">
                 <IconBuildingWarehouse size={16} className="mr-2 text-amber-500" /> Warehouse
               </Button>
               <Button variant="outline" className="w-full justify-start h-10 font-medium">
                 <IconTag size={16} className="mr-2 text-purple-500" /> Deal Status
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. LISTS & LEADERBOARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        <Card className="shadow-sm border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center justify-between">
              Top Customers
              <IconArrowUpRight size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {TOP_CUSTOMERS.map((cust, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs">
                      {i + 1}
                    </div>
                    <span className="font-semibold text-sm">{cust.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{cust.revenue}</div>
                    <div className={`text-xs font-semibold ${cust.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                      {cust.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center justify-between">
              Rep Leaderboard
              <IconTrophy size={16} className="text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {REP_LEADERBOARD.map((rep, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                      {rep.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{rep.name}</div>
                      <div className="text-xs text-zinc-500">{rep.sales} sales</div>
                    </div>
                  </div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {rep.revenue}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-red-100 dark:border-red-900/30">
          <CardHeader className="pb-4 bg-red-50/50 dark:bg-red-950/10 border-b border-black/5 dark:border-white/5">
            <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center justify-between">
              Margin at Risk
              <IconAlertTriangle size={16} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {MARGIN_AT_RISK.map((risk, i) => (
                <div key={i} className="flex flex-col p-4 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-blue-600 hover:underline cursor-pointer">{risk.quote}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${risk.risk === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {risk.risk} Risk
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-500">
                    <span>{risk.customer}</span>
                    <div className="flex gap-2">
                       <span className="font-semibold text-red-500">{risk.margin} Margin</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100">{risk.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center justify-between">
              Expiring in 7 Days
              <IconClock size={16} className="text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {EXPIRING_QUOTES.map((quote, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                  <div>
                    <div className="font-bold text-sm text-blue-600 hover:underline cursor-pointer mb-0.5">{quote.id}</div>
                    <div className="text-xs text-zinc-500 font-medium">{quote.client}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-0.5">{quote.value}</div>
                    <div className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded inline-block">
                      {quote.expires}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
