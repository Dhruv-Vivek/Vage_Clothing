import ReturnsManager from '@/components/admin/ReturnsManager';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminReturnsPage() {
  await requireAdminPage();
  return <ReturnsManager />;
}
