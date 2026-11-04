import OrderDetail from '@/components/admin/OrderDetail';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage({ params }) {
  await requireAdminPage();
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
