import InventoryManager from '@/components/admin/InventoryManager';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage() {
  await requireAdminPage();
  return <InventoryManager />;
}
