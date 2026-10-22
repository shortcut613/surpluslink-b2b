import { createFileRoute, Link } from "@tanstack/react-router";
import { donorImpactQueryOptions } from "./donor.impact";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/donor/compliance")({
  head: () => ({
    meta: [{ title: "Compliance Center — SurplusLink" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(donorImpactQueryOptions),
  component: DonorCompliance,
});

function DonorCompliance() {
  const { data: stats } = useSuspenseQuery(donorImpactQueryOptions);

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
    <div className="relative min-h-[calc(100vh-56px)] overflow-hidden page-transition">
      <div className="pointer-events-none absolute -top-1/4 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/5 blur-[150px] [animation-duration:15s]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[500px] animate-pulse rounded-full bg-secondary/5 blur-[120px] [animation-duration:10s]" />

      <main className="relative mx-auto max-w-7xl px-6 py-10 z-10">
        <Link
          to="/donor/impact"
          className="mb-8 inline-flex items-center text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Impact &amp; Records
        </Link>
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Compliance Center</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-widest">
            All your historical CSR impact and compliance reports
          </p>
        </div>

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
              {stats.documents.map((doc: any) => (
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
                        <Download className="mr-1.5 h-3.5 w-3.5" /> TXT
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
      </main>
    </div>
  );
}
