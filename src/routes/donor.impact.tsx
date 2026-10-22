import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, FileText, Package, Banknote, Leaf, ArrowUpRight } from "lucide-react";
import { calculateBatchImpact } from "@/lib/impact-math";

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function formatDateHelper(d: Date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const getDonorImpactStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: batches, error } = await supabase
    .from("donation_batches")
    .select("*, donation_items(*)")
    .eq("donor_id", user.id);

  if (error || !batches) {
    return {
      totalBatches: 0,
      totalValue: 0,
      totalCO2: 0,
      chartData: [],
      totalYearValue: 0,
      documents: [],
      hasTaxSubscription: true,
    };
  }

  let totalValue = 0;
  let totalCO2 = 0; // in kg
  let totalYearValue = 0;

  const currentYear = new Date().getFullYear();
  const monthData: Record<string, number> = {};
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const now = new Date();
  const last6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = monthNames[d.getMonth()];
    last6Months.push(mName);
    monthData[mName] = 0;
  }

  let docId = 1;
  const quartersMap = new Map();
  const yearsMap = new Map();

  for (const batch of batches) {
    const items = batch.donation_items || [];
    const batchImpact = calculateBatchImpact(items);
    const batchValue = batchImpact.totalValueZar;
    const batchCO2 = batchImpact.totalCo2Kg;

    totalValue += batchValue;
    totalCO2 += batchCO2;

    const createdAt =
      batch.created_at ||
      batch.created_date ||
      batch.date_submitted ||
      batch.timestamp ||
      new Date().toISOString();
    const bDate = new Date(createdAt);
    if (bDate.getFullYear() === currentYear) {
      totalYearValue += batchValue;
    }

    const mName = monthNames[bDate.getMonth()];
    if (
      monthData[mName] !== undefined &&
      bDate >= new Date(now.getFullYear(), now.getMonth() - 5, 1)
    ) {
      monthData[mName] += batchValue;
    }

    // Document Generation Logic
    const year = bDate.getFullYear();
    const quarter = Math.floor(bDate.getMonth() / 3) + 1;
    const qKey = `Q${quarter} ${year}`;
    const yKey = `${year}`;

    if (!quartersMap.has(qKey)) {
      quartersMap.set(qKey, {
        id: docId++,
        period: qKey,
        type: "Quarterly Impact Report",
        date: formatDateHelper(new Date(year, quarter * 3, 0)),
        stats: { batches: 0, value: 0, co2: 0 },
      });
    }
    const qDoc = quartersMap.get(qKey);
    qDoc.stats.batches += 1;
    qDoc.stats.value += batchValue;
    qDoc.stats.co2 += batchCO2;

    if (!yearsMap.has(yKey)) {
      yearsMap.set(yKey, {
        id: docId++,
        period: yKey,
        type: "Annual CSR Summary",
        date: formatDateHelper(new Date(year, 11, 31)),
        stats: { batches: 0, value: 0, co2: 0 },
      });
    }
    const yDoc = yearsMap.get(yKey);
    yDoc.stats.batches += 1;
    yDoc.stats.value += batchValue;
    yDoc.stats.co2 += batchCO2;
  }

  const chartData = last6Months.map((m) => ({ month: m, value: monthData[m] }));
  const documents = [...Array.from(quartersMap.values()), ...Array.from(yearsMap.values())];
  documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Add dummy doc if no history yet
  if (documents.length === 0) {
    documents.push({
      id: 999,
      period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
      type: "Quarterly Impact Report",
      date: formatDateHelper(new Date()),
      stats: { batches: 0, value: 0, co2: 0 },
    });
  }

  return {
    totalBatches: batches.length,
    totalValue,
    totalCO2: Number((totalCO2 / 1000).toFixed(1)),
    chartData,
    totalYearValue,
    documents,
    hasTaxSubscription: true,
  };
});

export const donorImpactQueryOptions = queryOptions({
  queryKey: ["donor", "impact"],
  queryFn: () => getDonorImpactStats(),
  staleTime: 1000 * 60 * 5,
});

export const Route = createFileRoute("/donor/impact")({
  head: () => ({
    meta: [{ title: "Impact & Records — SurplusLink" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(donorImpactQueryOptions),
  component: DonorImpact,
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-border rounded-xl p-3 shadow-lg">
        <p className="text-sm font-semibold mb-1 text-foreground">{label}</p>
        <p className="text-xs text-primary font-bold">
          Donation Value: R{Number(payload[0].value).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

function DonorImpact() {
  const { data: stats } = useSuspenseQuery(donorImpactQueryOptions);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tax certificates are now free for all food donors — no subscription required

  const handleDownloadReport = (doc: any, format: "csv" | "txt") => {
    let content = "";
    let filename = "";
    let mimeType = "";

    if (format === "csv") {
      content = `Period,Document Type,Generation Date,Batches Donated,Total Value (ZAR),CO2 Offset (kg)\n${doc.period},${doc.type},${doc.date},${doc.stats.batches},${doc.stats.value},${doc.stats.co2}`;
      filename = `SurplusLink_${doc.period.replace(" ", "_")}_Data.csv`;
      mimeType = "text/csv";
    } else {
      content = `SURPLUSLINK IMPACT REPORT\n=========================\n\nPeriod: ${doc.period}\nType: ${doc.type}\nGenerated: ${doc.date}\n\nIMPACT METRICS:\n- Total Batches Donated: ${doc.stats.batches}\n- Total Estimated Value: R${doc.stats.value.toLocaleString()}\n- Estimated CO2 Offset: ${doc.stats.co2} kg\n\nThank you for your contribution to reducing food waste!`;
      filename = `SurplusLink_${doc.period.replace(" ", "_")}_Report.txt`;
      mimeType = "text/plain";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="relative min-h-[calc(100vh-56px)] overflow-hidden page-transition">
        {/* Background blobs */}
        <div className="pointer-events-none absolute -top-1/4 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/5 blur-[150px] [animation-duration:15s]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[500px] animate-pulse rounded-full bg-secondary/5 blur-[120px] [animation-duration:10s]" />

        <main className="relative mx-auto max-w-7xl px-6 py-10 z-10">
          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Impact & Records</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Monitor your community impact and access compliance documentation.
            </p>
          </div>

          {/* Hero Metrics */}
          {/* Hero Metrics */}
          <div className="mb-12 grid gap-6 md:grid-cols-3">
            <MetricCard
              title="Food Batches Donated"
              value={stats.totalBatches.toLocaleString()}
              subtitle="batches"
              trend="Stable impact"
              icon={<Package className="h-5 w-5" />}
            />

            <MetricCard
              title="Total Donation Value"
              value={`R${stats.totalValue.toLocaleString()}`}
              trend="Growing contribution"
              icon={<Banknote className="h-5 w-5" />}
            />

            <MetricCard
              title="Estimated CO₂ Offset"
              value={stats.totalCO2.toLocaleString()}
              subtitle="tonnes"
              trend="Positive footprint"
              icon={<Leaf className="h-5 w-5" />}
            />
          </div>

          {/* Donation Value Chart */}
          <div
            className="mb-12 glass rounded-3xl p-8 shadow-sm"
            style={{ boxShadow: "0 8px 32px oklch(0.18 0.16 264 / 0.05)" }}
          >
            <h2 className="mb-8 text-lg font-bold text-foreground">
              Donation Value (Last 6 Months)
            </h2>

            <div className="h-[320px] w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.chartData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />

                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--color-muted-foreground)",
                        fontSize: 12,
                      }}
                      dy={10}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--color-muted-foreground)",
                        fontSize: 12,
                      }}
                      tickFormatter={(value) => `R${Number(value).toLocaleString()}`}
                    />

                    <Tooltip
                      cursor={{
                        fill: "var(--color-secondary)",
                        opacity: 0.5,
                      }}
                      content={<CustomTooltip />}
                    />

                    <Bar
                      dataKey="value"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Total Annual Donation Value */}
            <div className="mt-6 border-t pt-5">
              <p className="text-sm text-muted-foreground">
                Total Rand Value of Food Donated This Year
              </p>

              <p className="mt-1 text-2xl font-bold">R{stats.totalYearValue.toLocaleString()}</p>
            </div>
          </div>

          {/* Compliance Center */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Compliance Center</h2>
              {stats.hasTaxSubscription && (
                <Link
                  to="/donor/compliance"
                  className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                >
                  View All →
                </Link>
              )}
            </div>

            {/* Compliance Center — available to all food donors */}
            <div
              className="overflow-hidden rounded-3xl glass shadow-sm"
              style={{ boxShadow: "0 8px 32px oklch(0.18 0.16 264 / 0.05)" }}
            >
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium">Period</th>

                    <th className="px-6 py-4 text-left font-medium">Document Type</th>

                    <th className="px-6 py-4 text-left font-medium">Generation Date</th>

                    <th className="px-6 py-4 text-right font-medium">Export Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {stats.documents.map((doc) => (
                    <tr key={doc.id} className="group transition-colors hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">{doc.period}</td>

                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />

                          {doc.type}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-muted-foreground">{doc.date}</td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            onClick={() => handleDownloadReport(doc, "txt")}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            TXT
                          </button>

                          <button
                            className="inline-flex items-center justify-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            onClick={() => handleDownloadReport(doc, "csv")}
                          >
                            CSR Data
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="glass rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
      style={{ boxShadow: "0 8px 32px oklch(0.18 0.16 264 / 0.05)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground border border-border/50">
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-black tracking-tight text-foreground">{value}</p>
        {subtitle && (
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <div className="flex items-center justify-center rounded-full bg-emerald-500/10 p-1 text-emerald-600">
          <ArrowUpRight className="h-3 w-3" />
        </div>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{trend}</p>
      </div>
    </div>
  );
}
