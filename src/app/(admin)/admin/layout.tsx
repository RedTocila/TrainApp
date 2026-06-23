import { requireAdmin } from "@/lib/actions/auth";
import { getUnreadCount } from "@/lib/actions/notifications";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const unreadCount = await getUnreadCount(profile.id);

  return (
    <div className="flex min-h-screen">
      <AdminNav fullName={profile.full_name} unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
