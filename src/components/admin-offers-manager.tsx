"use client";

import { useState, useTransition } from "react";
import {
  deleteSubscriptionOffer,
  upsertSubscriptionOffer,
  uploadSubscriptionOfferImage,
} from "@/lib/actions/admin-offers";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { SoldSubscriptionPlanId } from "@/lib/subscription-plans";
import type { OfferInterval, SubscriptionOffer } from "@/lib/subscription-offers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toIsoFromLocalDatetime(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toLocalDatetimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function AdminOffersManager({
  offers,
  warning,
}: {
  offers: SubscriptionOffer[];
  warning?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isUploadingImage, startUploadTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    planId: "ai" as SoldSubscriptionPlanId,
    interval: "all" as OfferInterval,
    percentOff: 50,
    startsAt: "",
    endsAt: "",
    badgeText: "",
    imageUrl: "",
    active: true,
  });
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      name: "",
      planId: "ai",
      interval: "all",
      percentOff: 50,
      startsAt: "",
      endsAt: "",
      badgeText: "",
      imageUrl: "",
      active: true,
    });
    setEditingOfferId(null);
  };

  return (
    <div className="space-y-6">
      {warning ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {warning}
        </p>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">{editingOfferId ? "Edit Offer" : "Create Offer"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Offer name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="September Started Offer"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Plan</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.planId}
              onChange={(e) =>
                setForm((f) => ({ ...f, planId: e.target.value as SoldSubscriptionPlanId }))
              }
            >
              <option value="ai">AI Pro</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Interval</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.interval}
              onChange={(e) =>
                setForm((f) => ({ ...f, interval: e.target.value as OfferInterval }))
              }
            >
              <option value="all">All</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Percent OFF</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.percentOff}
              onChange={(e) =>
                setForm((f) => ({ ...f, percentOff: Number(e.target.value || 0) }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Badge text (optional)</Label>
            <Input
              value={form.badgeText}
              onChange={(e) => setForm((f) => ({ ...f, badgeText: e.target.value }))}
              placeholder="50% OFF"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="offer-image-file">Offer image (optional)</Label>
            <Input
              id="offer-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={isUploadingImage || isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError(null);
                startUploadTransition(async () => {
                  const uploadForm = new FormData();
                  uploadForm.set("file", file);
                  const result = await uploadSubscriptionOfferImage(uploadForm);
                  if ("error" in result) {
                    setError(result.error ?? "Could not upload offer image.");
                    return;
                  }
                  setForm((f) => ({ ...f, imageUrl: result.url }));
                });
              }}
            />
            {form.imageUrl ? (
              <div className="rounded-xl border border-border/70 bg-background/30 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt="Offer preview"
                  className="h-24 w-full rounded-md object-cover"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    disabled={isPending || isUploadingImage}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove image
                  </Button>
                </div>
              </div>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading image...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-3.5 w-3.5" />
                    Choose file to upload (JPG, PNG, WebP, GIF, max 5 MB)
                  </>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Starts at (optional)</Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ends at (optional)</Label>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </div>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Active
        </label>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <div className="mt-4">
          <Button
            disabled={isPending || isUploadingImage || !form.name.trim()}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await upsertSubscriptionOffer({
                  id: editingOfferId ?? undefined,
                  name: form.name,
                  planId: form.planId,
                  interval: form.interval,
                  percentOff: form.percentOff,
                  startsAt: toIsoFromLocalDatetime(form.startsAt),
                  endsAt: toIsoFromLocalDatetime(form.endsAt),
                  badgeText: form.badgeText || null,
                  imageUrl: form.imageUrl || null,
                  active: form.active,
                });
                if ("error" in res) setError(res.error ?? "Could not save offer.");
                else resetForm();
              });
            }}
          >
            {isPending ? "Saving..." : editingOfferId ? "Update offer" : "Create offer"}
          </Button>
          {editingOfferId ? (
            <Button
              type="button"
              variant="ghost"
              className="ml-2"
              onClick={resetForm}
              disabled={isPending || isUploadingImage}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Existing Offers</h2>
        <div className="mt-3 space-y-2">
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers yet.</p>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{offer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {offer.plan_id.toUpperCase()} · {offer.billing_interval} · {offer.percent_off}% OFF
                    {offer.active ? " · active" : " · inactive"}
                  </p>
                  {offer.image_url ? (
                    <div className="mt-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={offer.image_url}
                        alt=""
                        className="h-12 w-20 rounded-md border border-border/60 object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || isUploadingImage}
                    onClick={() => {
                      setError(null);
                      setEditingOfferId(offer.id);
                      setForm({
                        name: offer.name,
                        planId: offer.plan_id,
                        interval: offer.billing_interval,
                        percentOff: offer.percent_off,
                        startsAt: toLocalDatetimeInput(offer.starts_at),
                        endsAt: toLocalDatetimeInput(offer.ends_at),
                        badgeText: offer.badge_text ?? "",
                        imageUrl: offer.image_url ?? "",
                        active: offer.active,
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteSubscriptionOffer(offer.id);
                        if (editingOfferId === offer.id) resetForm();
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
