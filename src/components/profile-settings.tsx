"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { updateProfile, updatePassword } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { AccentColorPicker } from "@/components/accent-color-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GOAL_OPTIONS = [
  { value: "", label: "No goal set" },
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "stay_fit", label: "Stay fit" },
  { value: "improve_endurance", label: "Improve endurance" },
  { value: "general_health", label: "General health" },
];

export function ProfileSettings({
  fullName,
  email,
  goal,
}: {
  fullName: string;
  email: string;
  goal: string | null;
}) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const handleProfileSubmit = (formData: FormData) => {
    setProfileError(null);
    setProfileSuccess(false);
    startProfileTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        setProfileError(result.error);
      } else {
        setProfileSuccess(true);
      }
    });
  };

  const handlePasswordSubmit = (formData: FormData) => {
    setPasswordError(null);
    setPasswordSuccess(false);
    startPasswordTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) {
        setPasswordError(result.error);
      } else {
        setPasswordSuccess(true);
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-black">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal info</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={fullName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Fitness goal</Label>
              <select
                id="goal"
                name="goal"
                defaultValue={goal ?? ""}
                className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {profileError && (
              <p className="text-sm text-red-400">{profileError}</p>
            )}
            {profileSuccess && (
              <p className="text-sm text-green-400">Profile updated</p>
            )}
            <Button type="submit" disabled={isProfilePending}>
              {isProfilePending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Theme</p>
            <ThemeToggle variant="segmented" />
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Accent color</p>
            <AccentColorPicker />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                minLength={6}
                required
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-400">Password updated</p>
            )}
            <Button type="submit" variant="secondary" disabled={isPasswordPending}>
              {isPasswordPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
