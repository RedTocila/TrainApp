"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ClassFormState } from "@/lib/actions/classes";
import { CLASS_CATEGORIES } from "@/lib/class-utils";
import type { FitnessClass } from "@/lib/types";
import { CoverImageField } from "@/components/cover-image-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClassFormAction = (state: ClassFormState, formData: FormData) => Promise<ClassFormState>;

function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localToIso(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function AdminClassForm({
  action,
  fitnessClass,
  submitLabel,
}: {
  action: ClassFormAction;
  fitnessClass?: FitnessClass;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const [slug, setSlug] = useState(fitnessClass?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(fitnessClass));
  const [scheduledIso, setScheduledIso] = useState(fitnessClass?.scheduled_at ?? "");
  const scheduledRef = useRef<HTMLInputElement>(null);

  // Local time depends on the device timezone, so it is filled in after mount.
  useEffect(() => {
    if (fitnessClass && scheduledRef.current) {
      scheduledRef.current.value = toDatetimeLocalValue(fitnessClass.scheduled_at);
    }
  }, [fitnessClass]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={fitnessClass?.title}
          placeholder="Full-body strength live"
          onChange={(e) => {
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.target.value);
          }}
          placeholder="full-body-strength-mar-12"
        />
        <p className="text-xs text-muted-foreground">
          Used in the class link. Filled in from the title automatically.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={fitnessClass?.category ?? "Training"}
        >
          {CLASS_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduled_at">Live date & time</Label>
          <Input
            ref={scheduledRef}
            id="scheduled_at"
            name="scheduled_at"
            type="datetime-local"
            required
            onChange={(e) => setScheduledIso(localToIso(e.target.value))}
          />
          <input type="hidden" name="scheduled_at_iso" value={scheduledIso} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={15}
            step={15}
            defaultValue={fitnessClass?.duration_minutes ?? 60}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting_url">YouTube Live URL</Label>
        <Input
          id="meeting_url"
          name="meeting_url"
          type="url"
          defaultValue={fitnessClass?.meeting_url ?? ""}
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="replay_url">Replay link (YouTube — add after class ends)</Label>
        <Input
          id="replay_url"
          name="replay_url"
          type="url"
          defaultValue={fitnessClass?.replay_url ?? ""}
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      <CoverImageField defaultUrl={fitnessClass?.cover_image} />
      <div className="space-y-2">
        <Label htmlFor="description">Description (Markdown)</Label>
        <Textarea
          id="description"
          name="description"
          rows={8}
          defaultValue={fitnessClass?.description}
          placeholder="What clients will need, equipment, focus areas..."
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="published"
          name="published"
          className="rounded"
          defaultChecked={fitnessClass?.published ?? true}
        />
        <Label htmlFor="published">
          {fitnessClass ? "Published" : "Publish immediately"}
        </Label>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        <Link href="/admin/classes">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
