import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, ScanSearch, FolderKanban, LineChart, Check } from "lucide-react";
import { Icon3D } from "@/components/icon-3d";
import { ThemeToggle } from "@/components/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OrbitRep — AI Google Review Policy Scanner & Removal Cases" },
      {
        name: "description",
        content:
          "Scan Google reviews for policy violations with AI, build evidence-backed removal cases, and track reporting and appeals across every location.",
      },
      { property: "og:title", content: "OrbitRep — Reputation Intelligence for Google Reviews" },
      {
        property: "og:description",
        content:
          "AI policy scanning, evidence packages and removal case tracking for multi-location businesses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: "scanner" as const,
    title: "AI policy scanner",
    body: "Every review is assessed against Google's prohibited and restricted content policies — spam, fake content, off-topic, conflict of interest, harassment, threats, extortion and more.",
  },
  {
    icon: "cases" as const,
    title: "Evidence-backed cases",
    body: "Flagged reviews become removal cases with verbatim evidence, AI rationale, a full timeline and an exportable case summary for Google's reporting flow.",
  },
  {
    icon: "analytics" as const,
    title: "Reputation analytics",
    body: "Rating trends, violation distribution, location performance and resolution rate — the numbers you actually report to stakeholders.",
  },
];

const STEPS = [
  { label: "Import / sync", detail: "CSV or JSON review exports, per location." },
  { label: "AI scan", detail: "Resumable batch queue across thousands of reviews." },
  { label: "Prioritize", detail: "High, medium, review required or normal." },
  { label: "Evidence", detail: "Verbatim quotes, never fabricated." },
  { label: "Case", detail: "Assign, annotate, track history." },
  { label: "Report & appeal", detail: "Status tracked end to end." },
];

function Landing() {
  return (
    <div className="grid-bg min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet to-neon text-primary-foreground neon-outline">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold">
            Orbit<span className="text-gradient">Rep</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/auth"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:neon-outline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_10px_currentColor]" />
                Policy-compliant review intelligence
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                Find the Google reviews that
                <span className="text-gradient"> actually break policy</span>.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                OrbitRep scans thousands of Google reviews with AI, separates legitimate negative
                feedback from potential policy violations, and turns real violations into
                evidence-backed removal cases you can report and appeal — with full status tracking.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:neon-outline"
                >
                  Start free workspace <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/auth"
                  className="glass inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:neon-outline"
                >
                  See the command center
                </Link>
              </div>
              <p className="mt-5 max-w-lg text-xs leading-relaxed text-muted-foreground">
                OrbitRep never removes reviews from Google, never bypasses Google&apos;s systems and
                never fabricates evidence. Removal decisions belong to Google alone.
              </p>
            </div>

            <div className="card-3d relative overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet/30 to-transparent blur-3xl" />
              <div className="grid grid-cols-2 gap-4">
                {(["dashboard", "reviews", "scanner", "cases", "analytics", "reports"] as const).map(
                  (name) => (
                    <div
                      key={name}
                      className="glass flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium capitalize"
                    >
                      <Icon3D name={name} size={32} priority />
                      {name}
                    </div>
                  ),
                )}
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
                <div className="rounded-lg bg-danger/12 py-2 text-danger ring-1 ring-inset ring-danger/40">HIGH</div>
                <div className="rounded-lg bg-warning/12 py-2 text-warning ring-1 ring-inset ring-warning/40">MEDIUM</div>
                <div className="rounded-lg bg-caution/15 py-2 text-caution ring-1 ring-inset ring-caution/40">VERIFY</div>
                <div className="rounded-lg bg-success/12 py-2 text-success ring-1 ring-inset ring-success/40">NORMAL</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="card-3d card-3d-hover p-6">
                <Icon3D name={pillar.icon} size={44} className="float-slow" />
                <h2 className="mt-4 font-display text-lg font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            One pipeline, end to end
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.label} className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{step.label}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="card-3d grid gap-6 p-7 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Built for compliance, not shortcuts
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A one-star review is not a violation. OrbitRep explicitly labels legitimate negative
                feedback and routes it to the AI response assistant instead of a removal case.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Evidence is always verbatim from the review",
                  "No automatic or bulk report submission",
                  "Human verification queue for ambiguous cases",
                  "Full audit history on every case",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: ScanSearch, title: "Bulk scanning", body: "Resumable queue, no frozen UI." },
                { icon: FolderKanban, title: "Case workflow", body: "New → Reported → Resolved." },
                { icon: LineChart, title: "Client reports", body: "Exportable performance summaries." },
                { icon: ShieldCheck, title: "Role-based access", body: "Admin, manager, analyst." },
              ].map((item) => (
                <div key={item.title} className="glass rounded-xl p-4">
                  <item.icon className="h-5 w-5 text-neon" />
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        OrbitRep — reputation intelligence. Not affiliated with Google. Removal outcomes are decided
        by Google.
      </footer>
    </div>
  );
}
