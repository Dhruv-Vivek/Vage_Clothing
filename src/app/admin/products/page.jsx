import ProductsManager from '@/components/admin/ProductsManager';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  await requireAdminPage(); // layouts don't protect pages on their own; check again here
  return <ProductsManager />;
}
