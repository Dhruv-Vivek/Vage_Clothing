import Link from 'next/link';
import { query } from '@/lib/db';
import { LOW_STOCK_THRESHOLD, requireAdminPage } from '@/lib/admin';
import { inr } from '@/lib/format';
import AdminOperationsDashboard from '@/components/admin/AdminOperationsDashboard';

export const dynamic = 'force-dynamic';

const T = LOW_STOCK_THRESHOLD;

async function loadOverview() {
  const [products] = await query(
    `SELECT COALESCE(SUM(status = 'ACTIVE'), 0) AS active, COALESCE(SUM(status = 'DRAFT'), 0) AS drafts FROM products`
  );
  const [stock] = await query(
    `SELECT COALESCE(SUM(s.stock = 0), 0) AS out_of_stock,
            COALESCE(SUM(s.stock BETWEEN 1 AND ${T}), 0) AS low_stock
       FROM (SELECT COALESCE(i.stock_quantity, 0) AS stock
               FROM product_variants AS pv
               JOIN products AS p ON p.product_id = pv.product_id
               LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
              WHERE pv.is_active = 1 AND p.status = 'ACTIVE') AS s`
  );
  const [orders] = await query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status IN ('PENDING', 'CONFIRMED', 'PROCESSING')), 0) AS open_orders,
            COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount END), 0) AS revenue
       FROM orders`
  );
  const [customers] = await query(`SELECT COUNT(*) AS n FROM users WHERE role = 'CUSTOMER'`);
  const restock = await query(
    `SELECT p.name, pv.size, pv.color, pv.sku, COALESCE(i.stock_quantity, 0) AS stock
       FROM product_variants AS pv
       JOIN products AS p ON p.product_id = pv.product_id
       LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
      WHERE pv.is_active = 1 AND p.status = 'ACTIVE' AND COALESCE(i.stock_quantity, 0) <= ${T}
      ORDER BY stock ASC, p.name ASC
      LIMIT 8`
  );
  return { products, stock, orders, customers: Number(customers.n), restock };
}

export default async function AdminOverviewPage() {
  const admin = await requireAdminPage();
  const { products, stock, orders, customers, restock } = await loadOverview();

  const stats = [
    { label: 'Paid revenue', value: inr(orders.revenue), note: `${Number(orders.total)} order${Number(orders.total) === 1 ? '' : 's'} in total` },
    { label: 'Open orders', value: Number(orders.open_orders), note: 'Pending, confirmed or processing' },
    { label: 'Customers', value: customers, note: 'Registered accounts' },
    { label: 'Active products', value: Number(products.active), note: `${Number(products.drafts)} draft${Number(products.drafts) === 1 ? '' : 's'}` },
  ];

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {admin.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-light-gray">Here is where the store stands right now.</p>
      </header>

      <dl className="mb-10 grid grid-cols-2 divide-x divide-y divide-dark-border overflow-hidden rounded-xl border border-dark-border lg:grid-cols-4 lg:divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-4">
            <dt className="text-sm text-light-gray">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight">{s.value}</dd>
            <dd className="mt-1 text-xs text-light-gray">{s.note}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="restock-heading">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="restock-heading" className="text-lg font-semibold">
              Needs restocking
            </h2>
            <p className="text-sm text-light-gray">
              {Number(stock.out_of_stock)} out of stock · {Number(stock.low_stock)} running low (≤ {T} left)
            </p>
          </div>
          <Link href="/admin/inventory" className="text-sm text-lighter-gray underline hover:text-white">
            Open inventory
          </Link>
        </div>

        {restock.length === 0 ? (
          <p className="rounded-xl border border-dark-border px-5 py-8 text-center text-sm text-light-gray">
            Every active size and colour is above the low-stock level.
          </p>
        ) : (
          <ul className="divide-y divide-dark-border overflow-hidden rounded-xl border border-dark-border">
            {restock.map((row) => (
              <li key={row.sku} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="text-xs text-light-gray">
                    {row.size} · {row.color} · {row.sku}
                  </span>
                </div>
                <span className={Number(row.stock) === 0 ? 'font-medium text-red-400' : 'font-medium text-amber-400'}>
                  {Number(row.stock) === 0 ? 'Out of stock' : `${Number(row.stock)} left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminOperationsDashboard />
    </>
  );
}
