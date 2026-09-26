import { RouteEnter } from "@/components/route-enter";
import { IosFunnelShell } from "@/components/ios/ios-funnel-shell";

/**
 * Native-app funnel chrome — dark + red glow (same language as JOIN / register).
 * Web marketing pages are unchanged.
 */
export default function IosLayout({ children }: { children: React.ReactNode }) {
  return (
    <IosFunnelShell>
      <RouteEnter>{children}</RouteEnter>
    </IosFunnelShell>
  );
}
