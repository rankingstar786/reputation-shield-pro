import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteLocation, upsertLocation } from "@/lib/workspace.functions";
import { getBusinessStats } from "@/lib/reviews.functions";
import { useWorkspace } from "@/components/workspace";
import { BusinessGate } from "@/components/business-gate";
import { EmptyState, PageHeader, Panel } from "@/components/ui-kit";
import type { LocationRow } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({
    meta: [
      { title: "Locations — OrbitRep" },
      {
        name: "description",
        content: "Manage every business location and review its Google review volume, rating and flagged reviews.",
      },
      { property: "og:title", content: "Locations — OrbitRep" },
      { property: "og:description", content: "Location-based Google review management for multi-site businesses." },
    ],
  }),
  component: () => (
    <BusinessGate>
      <LocationsPage />
    </BusinessGate>
  ),
});

const EMPTY = { name: "", address: "", city: "", country: "", google_place_id: "" };

function LocationsPage() {
  const { activeBusiness, locations, refresh } = useWorkspace();
  const businessId = activeBusiness!.id;
  const save = useServerFn(upsertLocation);
  const remove = useServerFn(deleteLocation);
  const fetchStats = useServerFn(getBusinessStats);

  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: stats } = useQuery({
    queryKey: ["stats", businessId],
    queryFn: () => fetchStats({ data: { businessId } }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editing?.id ?? null,
          business_id: businessId,
          name: form.name.trim(),
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          google_place_id: form.google_place_id.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Location updated" : "Location added");
      setEditing(null);
      setForm({ ...EMPTY });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Location removed");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const metricsFor = (locationId: string) => {
    const reviews = (stats?.reviews ?? []).filter((r) => r.location_id === locationId);
    const cases = (stats?.cases ?? []).filter((c) => c.location_id === locationId);
    return {
      reviews: reviews.length,
      avg: reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0,
      flagged: reviews.filter((r) => r.violation_category && r.violation_category !== "none").length,
      cases: cases.length,
    };
  };

  return (
    <div>
      <PageHeader
        icon="locations"
        title="Locations"
        subtitle="Each location keeps its own review feed, flagged reviews and removal cases."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel className="p-0">
          {locations.length === 0 ? (
            <EmptyState
              icon="locations"
              title="No locations yet"
              description="Add your first Google Business Profile location to start segmenting reviews."
            />
          ) : (
            <ul className="divide-y divide-border/50">
              {locations.map((location) => {
                const metrics = metricsFor(location.id);
                return (
                  <li key={location.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold">{location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[location.address, location.city, location.country].filter(Boolean).join(", ") ||
                          "No address on file"}
                      </p>
                      {location.google_place_id ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Place ID: {location.google_place_id}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-5 text-center text-xs">
                      <div>
                        <p className="font-display text-base font-bold tabular-nums">{metrics.reviews}</p>
                        <p className="text-muted-foreground">reviews</p>
                      </div>
                      <div>
                        <p className="font-display text-base font-bold tabular-nums">{metrics.avg.toFixed(1)}</p>
                        <p className="text-muted-foreground">avg</p>
                      </div>
                      <div>
                        <p className="font-display text-base font-bold tabular-nums text-danger">
                          {metrics.flagged}
                        </p>
                        <p className="text-muted-foreground">flagged</p>
                      </div>
                      <div>
                        <p className="font-display text-base font-bold tabular-nums">{metrics.cases}</p>
                        <p className="text-muted-foreground">cases</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(location);
                          setForm({
                            name: location.name,
                            address: location.address ?? "",
                            city: location.city ?? "",
                            country: location.country ?? "",
                            google_place_id: location.google_place_id ?? "",
                          });
                        }}
                        className="glass rounded-lg px-3 py-1.5 text-xs transition-all hover:neon-outline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(location.id)}
                        className="glass rounded-lg px-2 py-1.5 text-danger transition-all hover:neon-outline"
                        aria-label={`Delete ${location.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="h-fit p-5">
          <h2 className="font-display text-lg font-semibold">
            {editing ? "Edit location" : "Add location"}
          </h2>
          <div className="mt-4 space-y-3">
            {(
              [
                ["name", "Location name", "Downtown flagship"],
                ["address", "Address", "128 Orbit Street"],
                ["city", "City", "Manchester"],
                ["country", "Country", "United Kingdom"],
                ["google_place_id", "Google Place ID", "ChIJ…"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block text-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-xl border border-border/60 bg-surface-2 px-3 py-2 outline-none focus:neon-outline"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || saveMutation.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editing ? "Save changes" : "Add location"}
            </button>
            {editing ? (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ ...EMPTY });
                }}
                className="glass rounded-xl px-3 py-2 text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
