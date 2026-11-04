import ProductIntelligenceDashboard from '@/components/admin/ProductIntelligenceDashboard';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminProductIntelligencePage() {
  await requireAdminPage();
  return <ProductIntelligenceDashboard />;
}
