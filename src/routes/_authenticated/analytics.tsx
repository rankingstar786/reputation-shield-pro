import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessStats } from "@/lib/reviews.functions";
import { useWorkspace } from "@/components/workspace";
import { BusinessGate } from "@/components/business-gate";
import { EmptyState, ErrorBlock, KpiCard, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { VIOLATION_LABELS, type ViolationCategory } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Reputation analytics — OrbitRep" },
      {
        name: "description",
        content:
          "Rating trends, violation distribution, scan coverage and location performance across your Google review portfolio.",
      },
      { property: "og:title", content: "Reputation analytics — OrbitRep" },
      { property: "og:description", content: "Charts and location benchmarks for your Google review reputation." },
    ],
  }),
  component: () => (
    <BusinessGate>
      <AnalyticsPage />
    </BusinessGate>
  ),
});

function AnalyticsPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness!.id;
  const fetchStats = useServerFn(getBusinessStats);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stats", businessId],
    queryFn: () => fetchStats({ data: { businessId } }),
  });

  const model = useMemo(() => {
    const reviews = data?.reviews ?? [];
    const cases = data?.cases ?? [];
    const locations = data?.locations ?? [];
    const total = reviews.length;
    const avg = total ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    const scanned = reviews.filter((r) => r.scan_status === "scanned").length;
    const flagged = reviews.filter((r) => r.violation_category && r.violation_category !== "none").length;
    const legit = reviews.filter((r) => r.is_legitimate_negative).length;

    const ratingSpread = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    }));

    const violations = new Map<ViolationCategory, number>();
    for (const review of reviews) {
      const category = review.violation_category as ViolationCategory | null;
      if (!category || category === "none") continue;
      violations.set(category, (violations.get(category) ?? 0) + 1);
    }
    const violationRows = Array.from(violations.entries()).sort((a, b) => b[1] - a[1]);

    const months = new Map<string, { sum: number; count: number }>();
    for (const review of reviews) {
      const key = String(review.review_date).slice(0, 7);
      const bucket = months.get(key) ?? { sum: 0, count: 0 };
      bucket.sum += review.rating;
      bucket.count += 1;
      months.set(key, bucket);
    }
    const trend = Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, bucket]) => ({ month, avg: bucket.sum / bucket.count, count: bucket.count }));

    const locationRows = locations.map((location) => {
      const scoped = reviews.filter((r) => r.location_id === location.id);
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

    const resolved = cases.filter((c) => c.status === "resolved").length;
    const closed = cases.filter((c) => c.status === "resolved" || c.status === "rejected").length;

    return {
      total,
      avg,
      scanned,
      flagged,
      legit,
      ratingSpread,
      violationRows,
      trend,
      locationRows,
      cases: cases.length,
      resolutionRate: closed ? Math.round((resolved / closed) * 100) : 0,
    };
  }, [data]);

  if (isLoading) return <LoadingBlock label="Crunching analytics" />;
  if (error) return <ErrorBlock message={(error as Error).message} retry={() => void refetch()} />;

  return (
    <div>
      <PageHeader
        icon="analytics"
        title="Reputation analytics"
        subtitle="Portfolio-level performance across ratings, policy violations and locations."
      />

      {model.total === 0 ? (
        <EmptyState
          icon="analytics"
          title="No review data yet"
          description="Import Google reviews from the review feed to unlock analytics."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total reviews" value={model.total} icon="reviews" />
            <KpiCard label="Average rating" value={model.avg.toFixed(2)} tone="success" />
            <KpiCard
              label="Scan coverage"
              value={`${model.total ? Math.round((model.scanned / model.total) * 100) : 0}%`}
              hint={`${model.scanned} scanned`}
              tone="neon"
              icon="scanner"
            />
            <KpiCard
              label="Potential violations"
              value={model.flagged}
              hint={`${model.legit} legitimate negatives`}
              tone="danger"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Rating trend</h2>
              <p className="text-xs text-muted-foreground">Monthly average, last 12 months.</p>
              <TrendChart points={model.trend} />
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Rating distribution</h2>
              <div className="mt-4 space-y-2">
                {model.ratingSpread.map((row) => {
                  const pct = model.total ? (row.count / model.total) * 100 : 0;
                  return (
                    <div key={row.star} className="flex items-center gap-3 text-sm">
                      <span className="w-10 tabular-nums text-muted-foreground">{row.star}★</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${
                            row.star >= 4 ? "bg-success" : row.star === 3 ? "bg-warning" : "bg-danger"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right tabular-nums text-muted-foreground">{row.count}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Violation distribution</h2>
              {model.violationRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No potential policy violations detected yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {model.violationRows.map(([category, count]) => {
                    const pct = model.flagged ? (count / model.flagged) * 100 : 0;
                    return (
                      <div key={category} className="flex items-center gap-3 text-sm">
                        <span className="w-52 truncate text-muted-foreground">
                          {VIOLATION_LABELS[category]}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet to-magenta"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-lg font-semibold">Location performance</h2>
              {model.locationRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Add locations to compare performance.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2">Location</th>
                        <th className="py-2 text-right">Reviews</th>
                        <th className="py-2 text-right">Avg</th>
                        <th className="py-2 text-right">Flagged</th>
                        <th className="py-2 text-right">Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.locationRows.map((row) => (
                        <tr key={row.id} className="border-t border-border/40">
                          <td className="py-2">{row.name}</td>
                          <td className="py-2 text-right tabular-nums">{row.reviews}</td>
                          <td className="py-2 text-right tabular-nums">{row.avg.toFixed(2)}</td>
                          <td className="py-2 text-right tabular-nums text-danger">{row.flagged}</td>
                          <td className="py-2 text-right tabular-nums">{row.cases}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: { month: string; avg: number; count: number }[] }) {
  if (points.length < 2)
    return <p className="mt-4 text-sm text-muted-foreground">Not enough history to plot a trend yet.</p>;
  const width = 720;
  const height = 200;
  const padding = 28;
  const step = (width - padding * 2) / (points.length - 1);
  const y = (value: number) => height - padding - ((value - 1) / 4) * (height - padding * 2);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${padding + index * step} ${y(point.avg)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full" role="img" aria-label="Average rating trend">
      <defs>
        <linearGradient id="trendStroke" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--violet)" />
          <stop offset="100%" stopColor="var(--neon)" />
        </linearGradient>
      </defs>
      {[1, 2, 3, 4, 5].map((tick) => (
        <g key={tick}>
          <line
            x1={padding}
            x2={width - padding}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="3 6"
          />
          <text x={4} y={y(tick) + 4} className="fill-muted-foreground text-[10px]">
            {tick}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="url(#trendStroke)" strokeWidth={3} strokeLinecap="round" />
      {points.map((point, index) => (
        <circle key={point.month} cx={padding + index * step} cy={y(point.avg)} r={4} className="fill-neon" />
      ))}
      {points.map((point, index) => (
        <text
          key={`label-${point.month}`}
          x={padding + index * step}
          y={height - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {point.month.slice(2)}
        </text>
      ))}
    </svg>
  );
}
