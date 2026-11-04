import AdminMessagesPage from '@/components/admin/AdminMessagesPage';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  await requireAdminPage();
  return <AdminMessagesPage />;
}
