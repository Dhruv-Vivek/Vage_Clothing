import OrdersManager from '@/components/admin/OrdersManager';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  await requireAdminPage();
  return <OrdersManager />;
}
