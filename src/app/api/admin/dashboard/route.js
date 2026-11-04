import { query } from '@/lib/db';
import { adminRoute } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const [
    summaryRows,
    customerRows,
    stockRows,
    messageRows,
    statusRows,
    revenueRows,
    recentOrders,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(payment_status = 'PAID'), 0) AS paid_orders,
              COALESCE(SUM(status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPED')), 0) AS orders_to_fulfil,
              COALESCE(SUM(CASE
                WHEN payment_status = 'PAID' AND status NOT IN ('CANCELLED','RETURNED')
                THEN total_amount ELSE 0 END), 0) AS total_revenue
         FROM orders`
    ),
    query(`SELECT COUNT(*) AS total_customers FROM users WHERE role = 'CUSTOMER' AND is_active = 1`),
    query(
      `SELECT COUNT(*) AS low_stock_variants
         FROM product_variants pv
         INNER JOIN products p ON p.product_id = pv.product_id
         LEFT JOIN inventory i ON i.variant_id = pv.variant_id
        WHERE pv.is_active = 1 AND p.status = 'ACTIVE'
          AND COALESCE(i.stock_quantity, 0) <= 5`
    ),
    query(
      `SELECT COUNT(*) AS unresolved_messages
         FROM contact_messages
        WHERE notification_status <> 'SENT' OR acknowledgement_status <> 'SENT'`
    ),
    query(
      `SELECT status, COUNT(*) AS order_count
         FROM orders
        GROUP BY status
        ORDER BY FIELD(status, 'PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED')`
    ),
    query(
      `SELECT DATE_FORMAT(p.paid_at, '%Y-%m-01') AS month_start,
              DATE_FORMAT(p.paid_at, '%b') AS month_label,
              COUNT(DISTINCT o.order_id) AS paid_orders,
              COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         INNER JOIN payments p ON p.order_id = o.order_id AND p.status = 'SUCCESS'
        WHERE p.paid_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
          AND o.status NOT IN ('CANCELLED','RETURNED')
        GROUP BY YEAR(p.paid_at), MONTH(p.paid_at),
                 DATE_FORMAT(p.paid_at, '%Y-%m-01'), DATE_FORMAT(p.paid_at, '%b')
        ORDER BY month_start`
    ),
    query(
      `SELECT o.order_id, o.order_number, o.status, o.payment_status,
              o.total_amount, o.created_at, u.full_name AS customer_name,
              u.email AS customer_email,
              (SELECT COALESCE(SUM(oi.quantity), 0)
                 FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count
         FROM orders o
         INNER JOIN users u ON u.user_id = o.user_id
        ORDER BY o.created_at DESC, o.order_id DESC
        LIMIT 8`
    ),
  ]);

  const summary = summaryRows[0] || {};
  const stats = {
    totalOrders: Number(summary.total_orders || 0),
    paidOrders: Number(summary.paid_orders || 0),
    ordersToFulfil: Number(summary.orders_to_fulfil || 0),
    totalRevenue: Number(summary.total_revenue || 0),
    totalCustomers: Number(customerRows[0]?.total_customers || 0),
    lowStockVariants: Number(stockRows[0]?.low_stock_variants || 0),
    unresolvedMessages: Number(messageRows[0]?.unresolved_messages || 0),
  };

  return {
    stats,
    orderStatuses: statusRows.map((row) => ({
      status: row.status,
      count: Number(row.order_count || 0),
    })),
    monthlyRevenue: revenueRows.map((row) => ({
      monthStart: row.month_start,
      month: row.month_label,
      revenue: Number(row.revenue || 0),
      paidOrders: Number(row.paid_orders || 0),
    })),
    recentOrders: recentOrders.map((row) => ({
      id: Number(row.order_id),
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      totalAmount: Number(row.total_amount),
      createdAt: row.created_at,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      itemCount: Number(row.item_count || 0),
    })),
  };
});
