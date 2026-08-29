import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { listCases } from "@/lib/cases.functions";
import { useWorkspace } from "@/components/workspace";
import { BusinessGate } from "@/components/business-gate";
import {
  EmptyState,
  ErrorBlock,
  KpiCard,
  PageHeader,
  Panel,
  SkeletonRows,
} from "@/components/ui-kit";
import { CaseStatusBadge, CategoryBadge, PriorityBadge, RatingStars } from "@/components/badges";
import {
  CASE_STATUS_FLOW,
  CASE_STATUS_LABELS,
  type CaseStatus,
  type ReviewPriority,
  type ViolationCategory,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Removal cases — OrbitRep" },
      {
        name: "description",
        content:
          "Track every Google review removal case from new to reported, appealed, resolved or rejected.",
      },
      { property: "og:title", content: "Removal cases — OrbitRep" },
      { property: "og:description", content: "Evidence-backed removal case pipeline and status tracking." },
    ],
  }),
  component: () => (
    <BusinessGate>
      <CasesPage />
    </BusinessGate>
  ),
});

type CaseListRow = {
  id: string;
  case_number: number;
  status: CaseStatus;
  violation_category: ViolationCategory;
  created_at: string;
  reported_at: string | null;
  resolved_at: string | null;
  evidence: unknown;
  reviews: {
    reviewer_name?: string;
    rating?: number;
    review_text?: string;
    review_date?: string;
    ai_confidence?: number | null;
    priority?: ReviewPriority;
  } | null;
  locations: { name?: string } | null;
};

function CasesPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness!.id;
  const fetchCases = useServerFn(listCases);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 15;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cases", businessId, status, search],
    queryFn: () => fetchCases({ data: { businessId, status, search } }),
  });

  const rows = (data ?? []) as unknown as CaseListRow[];
  const pageRows = rows.slice(page * perPage, page * perPage + perPage);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) map[row.status] = (map[row.status] ?? 0) + 1;
    return map;
  }, [rows]);

  const closed = (counts["resolved"] ?? 0) + (counts["rejected"] ?? 0);
  const resolutionRate = closed ? Math.round(((counts["resolved"] ?? 0) / closed) * 100) : 0;

  return (
    <div>
      <PageHeader
        icon="cases"
        title="Removal cases"
        subtitle="Every case is backed by verbatim evidence and follows Google's official reporting and appeal workflow."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open cases" value={rows.length - closed} icon="cases" tone="primary" />
        <KpiCard label="Reported" value={counts["reported"] ?? 0} tone="neon" />
        <KpiCard label="Resolved" value={counts["resolved"] ?? 0} tone="success" />
        <KpiCard
          label="Resolution rate"
          value={`${resolutionRate}%`}
          hint={`${closed} closed case${closed === 1 ? "" : "s"}`}
          tone="magenta"
        />
      </div>

      <Panel className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search case number, reviewer or text"
            className="w-full rounded-xl border border-border/60 bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:neon-outline"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-sm outline-none focus:neon-outline"
        >
          <option value="all">All statuses</option>
          {CASE_STATUS_FLOW.map((value) => (
            <option key={value} value={value}>
              {CASE_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Panel>

      <Panel className="overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorBlock message={(error as Error).message} retry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="cases"
            title="No removal cases yet"
            description="Open a case from a flagged review in the review feed. Only reviews with a potential policy violation are eligible."
            action={
              <Link
                to="/reviews"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Go to reviews
              </Link>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 transition-colors hover:bg-surface-2/60">
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        <Link to="/cases/$caseId" params={{ caseId: row.id }} className="text-primary hover:underline">
                          #{row.case_number}
                        </Link>
                      </td>
                      <td className="max-w-[320px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <RatingStars rating={row.reviews?.rating ?? 0} />
                          <span className="text-xs text-muted-foreground">
                            {row.reviews?.reviewer_name ?? "Unknown"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {row.reviews?.review_text || "No review text"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={row.violation_category} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={row.reviews?.priority ?? "normal"} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.locations?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <CaseStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {rows.length} case{rows.length === 1 ? "" : "s"} · page {page + 1} of {pages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="glass rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="glass rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
