import { getAdvancedSqlDashboard } from '@/lib/advanced-sql';

export const dynamic = 'force-dynamic';

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

function Section({ title, subtitle, children }) {
  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-dark-border">
      <div className="border-b border-dark-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-light-gray">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-8 text-center text-sm text-light-gray">
        No matching records yet. The report will populate as the store receives data.
      </td>
    </tr>
  );
}

export default async function AdminSqlLabPage() {
  const report = await getAdvancedSqlDashboard(30);

  return (
    <>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-light-gray">Database-powered admin view</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Advanced SQL insights</h1>
        <p className="mt-2 max-w-3xl text-sm text-light-gray">
          This page is a React Server Component. It calls server-only JavaScript query functions,
          which execute parameterized MySQL 8 statements. No browser-side database connection or
          client-side fetch to an internal API is used by this page.
        </p>
        <p className="mt-2 text-xs text-light-gray">
          Reporting window: {report.periodDays} days · Generated {dateLabel(report.generatedAt)}
        </p>
      </header>

      <Section
        title="Inventory risk by product"
        subtitle="CTEs, DENSE_RANK, AVG OVER, CASE expressions, joins and a correlated subquery for the latest inventory reason."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-dark-secondary text-xs text-light-gray">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Variants</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3">Category avg.</th>
                <th className="px-5 py-3">Health</th>
                <th className="px-5 py-3">Latest stock reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {report.inventoryRisk.length === 0 ? <Empty colSpan={7} /> : report.inventoryRisk.map((row) => (
                <tr key={row.product_id}>
                  <td className="px-5 py-3 font-medium">{row.product_name}</td>
                  <td className="px-5 py-3 text-light-gray">{row.category_name}</td>
                  <td className="px-5 py-3">{Number(row.active_variants)}</td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.total_stock)}</td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.category_average_stock)}</td>
                  <td className="px-5 py-3">{row.stock_health}</td>
                  <td className="max-w-48 truncate px-5 py-3 text-light-gray">{row.latest_inventory_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Top-selling products"
        subtitle="Paid-order aggregation, RANK and category-level AVG window function."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-dark-secondary text-xs text-light-gray">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Units</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Revenue</th>
                <th className="px-5 py-3">Vs category avg.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {report.productSales.length === 0 ? <Empty colSpan={7} /> : report.productSales.map((row) => (
                <tr key={row.product_id}>
                  <td className="px-5 py-3 tabular-nums">{Number(row.revenue_rank)}</td>
                  <td className="px-5 py-3 font-medium">{row.product_name}</td>
                  <td className="px-5 py-3 text-light-gray">{row.category_name}</td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.units_sold)}</td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.order_count)}</td>
                  <td className="px-5 py-3 tabular-nums">{money(row.revenue)}</td>
                  <td className="px-5 py-3 text-light-gray">{row.category_performance.replaceAll('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Highest-value customers"
        subtitle="CTE, DENSE_RANK, NTILE quartiles and a correlated subquery for each customer's lifetime last paid order."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-dark-secondary text-xs text-light-gray">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Paid orders</th>
                <th className="px-5 py-3">Spend</th>
                <th className="px-5 py-3">Value quartile</th>
                <th className="px-5 py-3">Latest paid order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {report.customerValue.length === 0 ? <Empty colSpan={6} /> : report.customerValue.map((row) => (
                <tr key={row.user_id}>
                  <td className="px-5 py-3 tabular-nums">{Number(row.spending_rank)}</td>
                  <td className="px-5 py-3">
                    <span className="block font-medium">{row.full_name}</span>
                    <span className="text-xs text-light-gray">{row.email}</span>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.paid_order_count)}</td>
                  <td className="px-5 py-3 tabular-nums">{money(row.total_spend)}</td>
                  <td className="px-5 py-3">Q{Number(row.value_quartile)}</td>
                  <td className="px-5 py-3 text-light-gray">{dateLabel(row.lifetime_last_paid_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="text-xs leading-5 text-light-gray">
        These are read-only reports. The app executes the SQL on the server using the existing
        mysql2 connection pool and parameter binding. The database password never reaches the browser.
      </p>
    </>
  );
}
