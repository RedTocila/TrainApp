"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import {
  getMailAudiencePreview,
  sendAdminMail,
  type MailRecipient,
  type SendAdminMailResult,
} from "@/lib/actions/admin-mail";
import {
  MAIL_AUDIENCE_OPTIONS,
  MAIL_PRESETS,
  getMailPreset,
  type MailAudience,
  type MailPresetId,
} from "@/lib/mail-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PickerClient = {
  id: string;
  fullName: string;
  email: string;
  label: string;
};

export function AdminMailComposer({
  clients,
  initialClientId,
}: {
  clients: PickerClient[];
  initialClientId?: string | null;
}) {
  const initialPreset = getMailPreset(
    initialClientId ? "custom" : "not_subscribed_checkin"
  );

  const [presetId, setPresetId] = useState<MailPresetId>(initialPreset.id);
  const [audience, setAudience] = useState<MailAudience>(
    initialClientId ? "single" : initialPreset.audience
  );
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [subject, setSubject] = useState(initialPreset.subject);
  const [body, setBody] = useState(initialPreset.body);
  const [ctaLabel, setCtaLabel] = useState(initialPreset.ctaLabel ?? "");
  const [ctaPath, setCtaPath] = useState(initialPreset.ctaPath ?? "");

  const [recipientCount, setRecipientCount] = useState(0);
  const [missingEmailCount, setMissingEmailCount] = useState(0);
  const [sampleRecipients, setSampleRecipients] = useState<MailRecipient[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [result, setResult] = useState<SendAdminMailResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  function applyPreset(id: MailPresetId) {
    const preset = getMailPreset(id);
    setPresetId(id);
    setSubject(preset.subject);
    setBody(preset.body);
    setCtaLabel(preset.ctaLabel ?? "");
    setCtaPath(preset.ctaPath ?? "");
    if (!initialClientId || audience !== "single") {
      setAudience(preset.audience);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    void getMailAudiencePreview({
      audience,
      clientId: audience === "single" ? clientId : null,
    }).then((preview) => {
      if (cancelled) return;
      setRecipientCount(preview.count);
      setMissingEmailCount(preview.missingEmailCount);
      setSampleRecipients(preview.recipients);
      setPreviewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [audience, clientId]);

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendAdminMail({
        audience,
        clientId: audience === "single" ? clientId : null,
        presetId,
        subject,
        body,
        ctaLabel: ctaLabel || null,
        ctaPath: ctaPath || null,
      });
      setResult(res);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {MAIL_PRESETS.map((preset) => {
                const active = presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/80 bg-background/40 hover:bg-background/70"
                    )}
                  >
                    <p className="text-sm font-semibold">{preset.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {MAIL_AUDIENCE_OPTIONS.map((option) => {
                const active = audience === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAudience(option.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/80 bg-background/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {
                MAIL_AUDIENCE_OPTIONS.find((o) => o.id === audience)
                  ?.description
              }
            </p>

            {audience === "single" ? (
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a client…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
                </select>
                {selectedClient ? (
                  <p className="text-xs text-muted-foreground">
                    Will send to {selectedClient.email}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                placeholder="Write your message…"
                className="min-h-[220px] font-mono text-[13px] leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-secondary px-1">{"{{name}}"}</code>{" "}
                for the client&apos;s first name. Blank lines become paragraphs.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ctaLabel">Button label (optional)</Label>
                <Input
                  id="ctaLabel"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="View plans"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctaPath">Button path (optional)</Label>
                <Input
                  id="ctaPath"
                  value={ctaPath}
                  onChange={(e) => setCtaPath(e.target.value)}
                  placeholder="/dashboard/pricing"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Ready to send
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3">
              {previewLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Counting recipients…
                </p>
              ) : (
                <>
                  <p className="text-2xl font-black tabular-nums">
                    {recipientCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    recipient{recipientCount === 1 ? "" : "s"} with email
                  </p>
                  {missingEmailCount > 0 ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {missingEmailCount} matched client
                      {missingEmailCount === 1 ? "" : "s"} missing email —
                      skipped
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {sampleRecipients.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Includes
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {sampleRecipients.map((r) => (
                    <li key={r.id} className="truncate text-foreground/90">
                      {r.fullName}{" "}
                      <span className="text-muted-foreground">· {r.email}</span>
                    </li>
                  ))}
                  {recipientCount > sampleRecipients.length ? (
                    <li className="text-muted-foreground">
                      +{recipientCount - sampleRecipients.length} more
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Sent as RUTINA &lt;noreply@rutina.al&gt;. Replies go to your admin
              email. Free Resend plan allows 100 emails/day (shared with auth
              mail).
            </p>

            <Button
              type="button"
              className="w-full"
              disabled={
                pending ||
                previewLoading ||
                recipientCount === 0 ||
                !subject.trim() ||
                !body.trim() ||
                (audience === "single" && !clientId)
              }
              onClick={handleSend}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send {recipientCount > 0 ? `(${recipientCount})` : ""}
                </>
              )}
            </Button>

            {result ? (
              <div
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm",
                  result.ok && result.failed === 0
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : result.ok
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                )}
              >
                <p className="font-medium">{result.message}</p>
                {result.errors.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs opacity-90">
                    {result.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
