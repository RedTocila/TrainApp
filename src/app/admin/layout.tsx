import { requireAdmin } from "@/lib/actions/auth";
import { getUnreadCount } from "@/lib/actions/notifications";
import { AdminNav } from "@/components/admin-nav";
import { AdminMobileHeader } from "@/components/admin-mobile-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const unreadCount = await getUnreadCount(profile.id);

  return (
    <div className="app-shell flex h-dvh min-h-0 overflow-hidden bg-background">
      <AdminNav fullName={profile.full_name} unreadCount={unreadCount} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminMobileHeader unreadCount={unreadCount} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background pb-20 pt-[var(--dashboard-mobile-header-height)] [-webkit-overflow-scrolling:touch] lg:pb-0 lg:pt-0">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
