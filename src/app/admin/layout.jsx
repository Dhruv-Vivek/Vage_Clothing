import AdminSidebar from '@/components/admin/AdminSidebar';
import { requireAdminPage } from '@/lib/admin';

export const metadata = { title: 'VAGE Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const user = await requireAdminPage();
  return (
    <div className="min-h-screen bg-dark text-white">
      <AdminSidebar name={user.name} />
      <div className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">{children}</div>
      </div>
    </div>
  );
}
