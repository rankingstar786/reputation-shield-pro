import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { addCaseNote, getCase, updateCase } from "@/lib/cases.functions";
import { BusinessGate } from "@/components/business-gate";
import { ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { CaseStatusBadge, CategoryBadge, ConfidenceMeter, PriorityBadge, RatingStars } from "@/components/badges";
import {
  CASE_STATUS_FLOW,
  CASE_STATUS_LABELS,
  VIOLATION_LABELS,
  type CaseStatus,
  type ReviewPriority,
  type ViolationCategory,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — OrbitRep" },
      {
        name: "description",
        content: "Full removal case record: review, AI analysis, evidence, timeline and status history.",
      },
      { property: "og:title", content: "Case detail — OrbitRep" },
      { property: "og:description", content: "Evidence package and audit history for a Google review removal case." },
    ],
  }),
  component: () => (
    <BusinessGate>
      <CaseDetailPage />
    </BusinessGate>
  ),
});

type CaseRecord = {
  id: string;
  case_number: number;
  status: CaseStatus;
  violation_category: ViolationCategory;
  evidence: unknown;
  notes: string | null;
  created_at: string;
  reported_at: string | null;
  appealed_at: string | null;
  resolved_at: string | null;
  reviews: {
    reviewer_name: string;
    rating: number;
    review_text: string;
    review_date: string;
    ai_confidence: number | null;
    ai_explanation: string | null;
    ai_evidence: unknown;
    recommended_action: string | null;
    priority: ReviewPriority;
    is_legitimate_negative: boolean;
    source_review_id: string | null;
  } | null;
  locations: { name?: string; address?: string; city?: string; country?: string; google_place_id?: string } | null;
  businesses: { name?: string; industry?: string; website?: string } | null;
};

type CaseEvent = {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
};

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

function buildEvidencePackage(record: CaseRecord, events: CaseEvent[]) {
  const review = record.reviews;
  const evidence = toStringList(record.evidence).length
    ? toStringList(record.evidence)
    : toStringList(review?.ai_evidence);
  return [
    `REMOVAL CASE SUMMARY — CASE #${record.case_number}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "BUSINESS",
    `Name: ${record.businesses?.name ?? "—"}`,
    `Industry: ${record.businesses?.industry ?? "—"}`,
    `Website: ${record.businesses?.website ?? "—"}`,
    `Location: ${record.locations?.name ?? "—"}`,
    `Address: ${[record.locations?.address, record.locations?.city, record.locations?.country]
      .filter(Boolean)
      .join(", ") || "—"}`,
    `Google Place ID: ${record.locations?.google_place_id ?? "—"}`,
    "",
    "REVIEW",
    `Reviewer: ${review?.reviewer_name ?? "—"}`,
    `Rating: ${review?.rating ?? "—"}/5`,
    `Date: ${review?.review_date ? new Date(review.review_date).toISOString().slice(0, 10) : "—"}`,
    `Source review id: ${review?.source_review_id ?? "—"}`,
    `Text: ${review?.review_text ?? "—"}`,
    "",
    "POLICY ASSESSMENT",
    `Category: ${VIOLATION_LABELS[record.violation_category]}`,
    `Priority: ${review?.priority ?? "—"}`,
    `AI confidence: ${review?.ai_confidence != null ? `${Math.round(review.ai_confidence)}%` : "—"}`,
    `Legitimate negative review: ${review?.is_legitimate_negative ? "yes" : "no"}`,
    `AI analysis: ${review?.ai_explanation ?? "—"}`,
    `Recommended action: ${review?.recommended_action ?? "—"}`,
    "",
    "SUPPORTING EVIDENCE",
    ...(evidence.length ? evidence.map((item, index) => `${index + 1}. ${item}`) : ["No evidence recorded."]),
    "",
    "CASE NOTES",
    record.notes || "None.",
    "",
    "TIMELINE",
    ...events.map(
      (event) => `${new Date(event.created_at).toISOString()} — ${event.event_type}: ${event.message ?? ""}`,
    ),
    "",
    "DISCLAIMER",
    "This summary supports a submission through Google's official review reporting and appeal",
    "workflow. Evidence is quoted verbatim from the published review. Removal decisions are made",
    "solely by Google and are never guaranteed.",
  ].join("\n");
}

function CaseDetailPage() {
  const { caseId } = useParams({ from: "/_authenticated/cases/$caseId" });
  const fetchCase = useServerFn(getCase);
  const saveCase = useServerFn(updateCase);
  const postNote = useServerFn(addCaseNote);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const record = data?.case as unknown as CaseRecord | undefined;
  const events = (data?.events ?? []) as unknown as CaseEvent[];

  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (record) setNotes(record.notes ?? "");
  }, [record?.id]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["cases"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: CaseStatus) => saveCase({ data: { caseId, status } }),
    onSuccess: (_result, status) => {
      toast.success(`Case moved to ${CASE_STATUS_LABELS[status]}`);
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const notesMutation = useMutation({
    mutationFn: () => saveCase({ data: { caseId, notes } }),
    onSuccess: () => {
      toast.success("Case notes saved");
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const noteMutation = useMutation({
    mutationFn: () => postNote({ data: { caseId, message: note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note added to case history");
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const evidence = useMemo(() => {
    if (!record) return [];
    const direct = toStringList(record.evidence);
    return direct.length ? direct : toStringList(record.reviews?.ai_evidence);
  }, [record]);

  if (isLoading) return <LoadingBlock label="Loading case" />;
  if (error) return <ErrorBlock message={(error as Error).message} retry={() => void refetch()} />;
  if (!record) return <ErrorBlock message="Case not found." />;

  const summary = buildEvidencePackage(record, events);

  const download = () => {
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orbitrep-case-${record.case_number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Link
        to="/cases"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All cases
      </Link>

      <PageHeader
        icon="cases"
        title={`Case #${record.case_number}`}
        subtitle={`Opened ${new Date(record.created_at).toLocaleString()} · ${VIOLATION_LABELS[record.violation_category]}`}
        actions={
          <>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(summary);
                toast.success("Case summary copied");
              }}
              className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:neon-outline"
            >
              <Copy className="h-4 w-4" /> Copy summary
            </button>
            <button
              onClick={download}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-all hover:neon-outline"
            >
              <Download className="h-4 w-4" /> Export package
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Review under case</h2>
              <CaseStatusBadge status={record.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <RatingStars rating={record.reviews?.rating ?? 0} />
              <span className="font-medium">{record.reviews?.reviewer_name ?? "Unknown"}</span>
              <span className="text-muted-foreground">
                {record.reviews?.review_date
                  ? new Date(record.reviews.review_date).toLocaleDateString()
                  : "—"}
              </span>
              <span className="text-muted-foreground">{record.locations?.name ?? "No location"}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-border/60 bg-surface-2 p-4 text-sm leading-relaxed">
              {record.reviews?.review_text || "No review text."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CategoryBadge category={record.violation_category} />
              <PriorityBadge priority={record.reviews?.priority ?? "normal"} />
              <ConfidenceMeter value={record.reviews?.ai_confidence ?? null} />
            </div>
            {record.reviews?.is_legitimate_negative ? (
              <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                This review was assessed as legitimate negative feedback. A removal report is not
                appropriate — respond publicly instead.
              </p>
            ) : null}
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">AI analysis</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {record.reviews?.ai_explanation ?? "This review has not been scanned yet."}
            </p>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Supporting evidence
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {evidence.length ? (
                evidence.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-muted-foreground"
                  >
                    “{item}”
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">No evidence recorded.</li>
              )}
            </ul>
            {record.reviews?.recommended_action ? (
              <p className="mt-4 rounded-xl border border-neon/40 bg-neon/8 p-3 text-sm">
                <span className="font-semibold">Recommended action: </span>
                {record.reviews.recommended_action}
              </p>
            ) : null}
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Case notes</h2>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Internal notes: verification steps, context, submission references…"
              className="mt-3 w-full rounded-xl border border-border/60 bg-surface-2 p-3 text-sm outline-none focus:neon-outline"
            />
            <button
              onClick={() => notesMutation.mutate()}
              disabled={notesMutation.isPending}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {notesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save notes
            </button>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Workflow status</h2>
            <div className="mt-3 grid gap-2">
              {CASE_STATUS_FLOW.map((value) => {
                const active = record.status === value;
                return (
                  <button
                    key={value}
                    onClick={() => statusMutation.mutate(value)}
                    disabled={statusMutation.isPending || active}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all ${
                      active
                        ? "border-primary/50 bg-primary/12 font-semibold text-primary"
                        : "border-border/60 hover:neon-outline"
                    }`}
                  >
                    {CASE_STATUS_LABELS[value]}
                    {active ? <span className="text-xs">current</span> : null}
                  </button>
                );
              })}
            </div>
            <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Reported</dt>
                <dd>{record.reported_at ? new Date(record.reported_at).toLocaleDateString() : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Appealed</dt>
                <dd>{record.appealed_at ? new Date(record.appealed_at).toLocaleDateString() : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Closed</dt>
                <dd>{record.resolved_at ? new Date(record.resolved_at).toLocaleDateString() : "—"}</dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Case history</h2>
            <ol className="mt-3 space-y-3 border-l border-border/60 pl-4 text-sm">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-neon shadow-[0_0_10px_currentColor]" />
                  <p className="font-medium">{event.event_type.replace("status:", "Status → ")}</p>
                  {event.message ? <p className="text-muted-foreground">{event.message}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
              {events.length === 0 ? <li className="text-muted-foreground">No history yet.</li> : null}
            </ol>
            <div className="mt-4 flex gap-2">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-sm outline-none focus:neon-outline"
              />
              <button
                onClick={() => noteMutation.mutate()}
                disabled={!note.trim() || noteMutation.isPending}
                className="glass rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Evidence package preview</h2>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {summary}
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  );
}
