"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/landing-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const message = String(data.get("message") ?? "");
    const subject = encodeURIComponent(`TrainApp contact from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <form onSubmit={handleSubmit} className="premium-card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Your name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help?"
        />
      </div>
      <Button type="submit" className="w-full sm:w-auto">
        Send message
      </Button>
      {sent && (
        <p className="text-sm text-muted-foreground">
          Your email app should open with a pre-filled message. If it didn&apos;t,
          write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      )}
    </form>
  );
}

export function ContactPageContent() {
  return (
    <div className="not-prose grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="premium-card flex gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Email</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-1 text-sm text-muted-foreground">
              Typical response within 1–2 business days.
            </p>
          </div>
        </div>

        <div className="premium-card flex gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Support topics</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Account & login issues</li>
              <li>Subscription & billing</li>
              <li>Custom workout / nutrition plans</li>
              <li>AI features & live coaching</li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          for faster support from your dashboard.
        </p>
      </div>

      <ContactForm />
    </div>
  );
}
