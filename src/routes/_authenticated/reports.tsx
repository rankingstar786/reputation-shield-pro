import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getBusinessStats } from "@/lib/reviews.functions";
import { useWorkspace } from "@/components/workspace";
import { BusinessGate } from "@/components/business-gate";
import { EmptyState, ErrorBlock, KpiCard, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { CASE_STATUS_LABELS, VIOLATION_LABELS, type CaseStatus, type ViolationCategory } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Client reports — OrbitRep" },
      {
        name: "description",
        content:
          "Generate shareable reputation reports: review volume, rating change, violations detected and case outcomes by location.",
      },
      { property: "og:title", content: "Client reports — OrbitRep" },
      { property: "og:description", content: "Exportable Google review reputation reporting for clients and stakeholders." },
    ],
  }),
  component: () => (
    <BusinessGate>
      <ReportsPage />
    </BusinessGate>
  ),
});

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

function ReportsPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness!.id;
  const fetchStats = useServerFn(getBusinessStats);
  const [range, setRange] = useState("90");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stats", businessId],
    queryFn: () => fetchStats({ data: { businessId } }),
  });

  const report = useMemo(() => {
    const allReviews = data?.reviews ?? [];
    const allCases = data?.cases ?? [];
    const locations = data?.locations ?? [];
    const days = range === "all" ? null : Number(range);
    const cutoff = days ? Date.now() - days * 86_400_000 : null;
    const previousCutoff = days ? Date.now() - days * 2 * 86_400_000 : null;

    const inRange = cutoff
      ? allReviews.filter((r) => new Date(r.review_date).getTime() >= cutoff)
      : allReviews;
    const previous =
      cutoff && previousCutoff
        ? allReviews.filter((r) => {
            const time = new Date(r.review_date).getTime();
            return time >= previousCutoff && time < cutoff;
          })
        : [];

    const cases = cutoff
      ? allCases.filter((c) => new Date(c.created_at).getTime() >= cutoff)
      : allCases;

    const avg = inRange.length ? inRange.reduce((sum, r) => sum + r.rating, 0) / inRange.length : 0;
    const prevAvg = previous.length ? previous.reduce((sum, r) => sum + r.rating, 0) / previous.length : 0;

    const statusCounts = cases.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const resolved = statusCounts["resolved"] ?? 0;
    const rejected = statusCounts["rejected"] ?? 0;

    const violations = new Map<ViolationCategory, number>();
    for (const review of inRange) {
      const category = review.violation_category as ViolationCategory | null;
      if (!category || category === "none") continue;
      violations.set(category, (violations.get(category) ?? 0) + 1);
    }

    const locationRows = locations.map((location) => {
      const scoped = inRange.filter((r) => r.location_id === location.id);
      const scopedCases = cases.filter((c) => c.location_id === location.id);
      return {
        id: location.id,
        name: location.name,
        reviews: scoped.length,
        avg: scoped.length ? scoped.reduce((sum, r) => sum + r.rating, 0) / scoped.length : 0,
        flagged: scoped.filter((r) => r.violation_category && r.violation_category !== "none").length,
        cases: scopedCases.length,
        resolved: scopedCases.filter((c) => c.status === "resolved").length,
      };
    });

    return {
      volume: inRange.length,
      previousVolume: previous.length,
      avg,
      prevAvg,
      delta: prevAvg ? avg - prevAvg : 0,
      flagged: inRange.filter((r) => r.violation_category && r.violation_category !== "none").length,
      legit: inRange.filter((r) => r.is_legitimate_negative).length,
      cases: cases.length,
      statusCounts,
      resolved,
      rejected,
      resolutionRate: resolved + rejected ? Math.round((resolved / (resolved + rejected)) * 100) : 0,
      violations: Array.from(violations.entries()).sort((a, b) => b[1] - a[1]),
      locationRows,
    };
  }, [data, range]);

  const text = useMemo(() => {
    const label = RANGES.find((r) => r.value === range)?.label ?? range;
    return [
      `REPUTATION REPORT — ${activeBusiness?.name ?? ""}`,
      `Period: ${label}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Review volume: ${report.volume} (previous period: ${report.previousVolume})`,
      `Average rating: ${report.avg.toFixed(2)}${
        report.prevAvg ? ` (change ${report.delta >= 0 ? "+" : ""}${report.delta.toFixed(2)})` : ""
      }`,
      `Potential policy violations: ${report.flagged}`,
      `Legitimate negative reviews: ${report.legit}`,
      `Cases created: ${report.cases}`,
      `Cases reported: ${report.statusCounts["reported"] ?? 0}`,
      `Cases in appeal: ${report.statusCounts["appeal"] ?? 0}`,
      `Cases resolved: ${report.resolved}`,
      `Cases rejected: ${report.rejected}`,
      `Resolution rate: ${report.resolutionRate}%`,
      "",
      "VIOLATION BREAKDOWN",
      ...(report.violations.length
        ? report.violations.map(([category, count]) => `- ${VIOLATION_LABELS[category]}: ${count}`)
        : ["- None detected"]),
      "",
      "LOCATION COMPARISON",
      ...report.locationRows.map(
        (row) =>
          `- ${row.name}: ${row.reviews} reviews, avg ${row.avg.toFixed(2)}, ${row.flagged} flagged, ${row.cases} cases (${row.resolved} resolved)`,
      ),
      "",
      "Removal outcomes are decided by Google. OrbitRep supports the official reporting and appeal workflow only.",
    ].join("\n");
  }, [report, range, activeBusiness]);

  if (isLoading) return <LoadingBlock label="Building report" />;
  if (error) return <ErrorBlock message={(error as Error).message} retry={() => void refetch()} />;

  const downloadCsv = () => {
    const rows = [
      ["location", "reviews", "average_rating", "flagged", "cases", "resolved"],
      ...report.locationRows.map((row) => [
        row.name,
        String(row.reviews),
        row.avg.toFixed(2),
        String(row.flagged),
        String(row.cases),
        String(row.resolved),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orbitrep-report-${range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        icon="reports"
        title="Client reports"
        subtitle="Period performance you can hand straight to a client or stakeholder."
        actions={
          <>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="glass rounded-xl px-3 py-2 text-sm outline-none focus:neon-outline"
              aria-label="Reporting period"
            >
              {RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(text);
                toast.success("Report copied");
              }}
              className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:neon-outline"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-all hover:neon-outline"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      {report.volume === 0 && report.cases === 0 ? (
        <EmptyState
          icon="reports"
          title="Nothing to report for this period"
          description="Import reviews or widen the reporting period to generate a client report."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Review volume"
              value={report.volume}
              hint={`previous period: ${report.previousVolume}`}
              icon="reviews"
            />
            <KpiCard
              label="Average rating"
              value={report.avg.toFixed(2)}
              hint={report.prevAvg ? `${report.delta >= 0 ? "+" : ""}${report.delta.toFixed(2)} vs previous` : undefined}
              tone="success"
            />
            <KpiCard label="Potential violations" value={report.flagged} tone="danger" />
            <KpiCard label="Resolution rate" value={`${report.resolutionRate}%`} tone="magenta" icon="cases" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Case outcomes</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{CASE_STATUS_LABELS[status]}</span>
                    <span className="font-display font-bold tabular-nums">
                      {report.statusCounts[status] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Location comparison</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2">Location</th>
                      <th className="py-2 text-right">Reviews</th>
                      <th className="py-2 text-right">Avg</th>
                      <th className="py-2 text-right">Flagged</th>
                      <th className="py-2 text-right">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.locationRows.map((row) => (
                      <tr key={row.id} className="border-t border-border/40">
                        <td className="py-2">{row.name}</td>
                        <td className="py-2 text-right tabular-nums">{row.reviews}</td>
                        <td className="py-2 text-right tabular-nums">{row.avg.toFixed(2)}</td>
                        <td className="py-2 text-right tabular-nums text-danger">{row.flagged}</td>
                        <td className="py-2 text-right tabular-nums text-success">{row.resolved}</td>
                      </tr>
                    ))}
                    {report.locationRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-muted-foreground">
                          No locations configured.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Report text</h2>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {text}
            </pre>
          </Panel>
        </div>
      )}
    </div>
  );
}
