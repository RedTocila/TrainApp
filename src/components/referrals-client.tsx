"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  Link2,
  Share2,
  Sparkles,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  applyReferralCode,
  type ReferralDashboard,
} from "@/lib/actions/referrals";
import { formatReferralCreditEuros } from "@/lib/referral";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ReferralsClient({
  initial,
}: {
  initial: ReferralDashboard;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const copy = platform.referral;
  const [data, setData] = useState(initial);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balanceLabel = useMemo(
    () => formatReferralCreditEuros(data.balanceCents, locale),
    [data.balanceCents, locale]
  );

  const copyText = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError(copy.invalidCode);
    }
  };

  const onApply = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyReferralCode(codeInput);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage(copy.codeApplied);
      setCodeInput("");
      setData((prev) => ({ ...prev, canApplyCode: false }));
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-black">{copy.title}</h1>
          <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm font-black">{copy.howItWorks}</p>

          <div className="flex items-start gap-0.5 overflow-x-auto pb-1">
            {(
              [
                {
                  icon: Share2,
                  title: copy.flowShareTitle,
                  desc: copy.flowShareDesc,
                  accent: "bg-primary/10 text-primary",
                },
                {
                  icon: Ticket,
                  title: copy.flowFriendTitle,
                  desc: copy.flowFriendDesc,
                  accent: "bg-emerald-500/10 text-emerald-500",
                },
                {
                  icon: Wallet,
                  title: copy.flowYouTitle,
                  desc: copy.flowYouDesc,
                  accent: "bg-amber-500/10 text-amber-500",
                },
                {
                  icon: Sparkles,
                  title: copy.flowSpendTitle,
                  desc: copy.flowSpendDesc,
                  accent: "bg-sky-500/10 text-sky-500",
                },
              ] as const
            ).map((step, index, steps) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              return (
                <div key={step.title} className="flex min-w-0 flex-1 items-start">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl",
                        step.accent
                      )}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold leading-tight sm:mt-2 sm:text-sm">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                      {step.desc}
                    </p>
                  </div>
                  {!isLast ? (
                    <ArrowRight
                      className="mt-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 sm:mt-3.5 sm:h-4 sm:w-4"
                      aria-hidden
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="rounded-xl bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
            {copy.ruleTwo}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.yourCode}
            </p>
            <p className="mt-1 font-mono text-2xl font-black tracking-widest">
              {data.code}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyText(data.code, "code")}
            >
              {copied === "code" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied === "code" ? copy.copied : copy.copyCode}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyText(data.shareUrl, "link")}
            >
              {copied === "link" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copied === "link" ? copy.copied : copy.shareLink}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wider">
                {copy.balance}
              </p>
            </div>
            <p className="text-xl font-black tabular-nums">{balanceLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.invites}
            </p>
            <p className="text-xl font-black tabular-nums">{data.qualifiedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.pendingInvites}
            </p>
            <p className="text-xl font-black tabular-nums">{data.pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {data.canApplyCode ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="referral-code">{copy.enterCode}</Label>
              <Input
                id="referral-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={copy.codePlaceholder}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <Button
              type="button"
              disabled={isPending || !codeInput.trim()}
              onClick={onApply}
            >
              {copy.applyCode}
            </Button>
          </CardContent>
        </Card>
      ) : data.referredByCode ? (
        <p className="text-sm text-muted-foreground">
          {copy.codeApplied}: <span className="font-mono font-semibold">{data.referredByCode}</span>
        </p>
      ) : null}

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-black">{copy.history}</p>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.emptyHistory}</p>
          ) : (
            <ul className="space-y-2">
              {data.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString(
                        locale === "al" ? "sq-AL" : "en-GB"
                      )}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      tx.amountCents >= 0 ? "text-emerald-400" : "text-foreground"
                    )}
                  >
                    {tx.amountCents >= 0 ? "+" : ""}
                    {formatReferralCreditEuros(tx.amountCents, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
