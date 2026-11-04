import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { adminRoute } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  try {
    const pool = getPool();
    const [
      [summaryRows],
      [customerRows],
      [stockRows],
      [messageRows],
      [statusRows],
      [revenueRows],
      [recentOrders],
    ] = await Promise.all([
      pool.execute(
        "SELECT COUNT(*) AS total_orders, " +
        "COALESCE(SUM(payment_status = 'PAID'), 0) AS paid_orders, " +
        "COALESCE(SUM(payment_status = 'PAID' AND status IN ('CONFIRMED','PROCESSING')), 0) AS orders_to_fulfil, " +
        "COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) AS total_revenue " +
        "FROM orders"
      ),
      pool.execute(
        "SELECT COUNT(*) AS total_customers FROM users WHERE role = 'CUSTOMER' AND is_active = 1"
      ),
      pool.execute(
        "SELECT COUNT(*) AS low_stock_variants " +
        "FROM inventory i " +
        "INNER JOIN product_variants pv ON pv.variant_id = i.variant_id " +
        "INNER JOIN products p ON p.product_id = pv.product_id " +
        "WHERE p.status = 'ACTIVE' AND i.stock_quantity <= 5"
      ),
      pool.execute(
        "SELECT COUNT(*) AS unresolved_messages FROM contact_messages " +
        "WHERE notification_status <> 'SENT' OR acknowledgement_status <> 'SENT'"
      ),
      pool.execute(
        "SELECT status, COUNT(*) AS order_count FROM orders " +
        "GROUP BY status " +
        "ORDER BY FIELD(status, 'PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED')"
      ),
      pool.execute(
        "SELECT DATE_FORMAT(p.paid_at, '%Y-%m-01') AS month_start, " +
        "DATE_FORMAT(p.paid_at, '%b') AS month_label, " +
        "COUNT(DISTINCT o.order_id) AS paid_orders, COALESCE(SUM(o.total_amount), 0) AS revenue " +
        "FROM orders o INNER JOIN payments p ON p.order_id = o.order_id AND p.status = 'SUCCESS' " +
        "WHERE p.paid_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01') " +
        "GROUP BY YEAR(p.paid_at), MONTH(p.paid_at), DATE_FORMAT(p.paid_at, '%Y-%m-01'), DATE_FORMAT(p.paid_at, '%b') " +
        "ORDER BY month_start"
      ),
      pool.execute(
        "SELECT o.order_id, o.order_number, o.status, o.payment_status, o.total_amount, o.created_at, " +
        "u.full_name AS customer_name, COALESCE(NULLIF(o.contact_email, ''), u.email) AS customer_email, " +
        "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count " +
        "FROM orders o INNER JOIN users u ON u.user_id = o.user_id " +
        "ORDER BY o.created_at DESC, o.order_id DESC LIMIT 8"
      ),
    ]);

    const summary = summaryRows[0] || {};
    return {
      stats: {
        totalOrders: Number(summary.total_orders || 0),
        paidOrders: Number(summary.paid_orders || 0),
        ordersToFulfil: Number(summary.orders_to_fulfil || 0),
        totalRevenue: Number(summary.total_revenue || 0),
        totalCustomers: Number(customerRows[0]?.total_customers || 0),
        lowStockVariants: Number(stockRows[0]?.low_stock_variants || 0),
        unresolvedMessages: Number(messageRows[0]?.unresolved_messages || 0),
      },
      orderStatuses: statusRows.map((row) => ({
        status: row.status,
        count: Number(row.order_count || 0),
      })),
      monthlyRevenue: revenueRows.map((row) => ({
        month: row.month_label,
        revenue: Number(row.revenue || 0),
        paidOrders: Number(row.paid_orders || 0),
      })),
      recentOrders,
    };
  } catch (error) {
    console.error('[GET /api/admin/dashboard] Failed:', error);
    throw new Error('Unable to load dashboard data.');
  }
});