-- VAGE Clothing — MySQL 8 advanced SQL demonstration
-- READ-ONLY report queries against the existing schema_dump.sql schema.
-- Run in a non-production/test database. No INSERT/UPDATE/DELETE/DDL is performed here.

SET @report_days = 30;

-- 1) CTE + window functions + correlated subquery + CASE.
-- Inventory health and risk ranking within each category.
WITH inventory_snapshot AS (
    SELECT
        p.product_id,
        p.name AS product_name,
        c.category_id,
        c.name AS category_name,
        COUNT(DISTINCT pv.variant_id) AS active_variants,
        COALESCE(SUM(i.stock_quantity), 0) AS total_stock
    FROM products AS p
    INNER JOIN categories AS c
        ON c.category_id = p.category_id
    LEFT JOIN product_variants AS pv
        ON pv.product_id = p.product_id
       AND pv.is_active = 1
    LEFT JOIN inventory AS i
        ON i.variant_id = pv.variant_id
    WHERE p.status = 'ACTIVE'
      AND c.is_active = 1
    GROUP BY p.product_id, p.name, c.category_id, c.name
),
ranked_inventory AS (
    SELECT
        inventory_snapshot.*,
        DENSE_RANK() OVER (
            PARTITION BY category_id
            ORDER BY total_stock ASC
        ) AS stock_risk_rank,
        AVG(total_stock) OVER (
            PARTITION BY category_id
        ) AS category_average_stock
    FROM inventory_snapshot
)
SELECT
    product_id,
    product_name,
    category_name,
    active_variants,
    total_stock,
    stock_risk_rank,
    ROUND(category_average_stock, 2) AS category_average_stock,
    CASE
        WHEN total_stock = 0 THEN 'OUT_OF_STOCK'
        WHEN total_stock <= 5 THEN 'CRITICAL'
        WHEN total_stock <= 10 THEN 'LOW'
        ELSE 'HEALTHY'
    END AS stock_health,
    (
        SELECT il.reason
        FROM inventory_log AS il
        INNER JOIN product_variants AS pv2
            ON pv2.variant_id = il.variant_id
        WHERE pv2.product_id = ranked_inventory.product_id
        ORDER BY il.created_at DESC, il.log_id DESC
        LIMIT 1
    ) AS latest_inventory_reason
FROM ranked_inventory
ORDER BY total_stock ASC, product_name ASC
LIMIT 10;

-- 2) CTE + aggregate + RANK + AVG OVER.
-- Highest-revenue products in the selected paid-order reporting window.
WITH paid_product_sales AS (
    SELECT
        p.product_id,
        p.name AS product_name,
        c.name AS category_name,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.line_total) AS revenue,
        COUNT(DISTINCT o.order_id) AS order_count
    FROM order_items AS oi
    INNER JOIN orders AS o
        ON o.order_id = oi.order_id
    INNER JOIN product_variants AS pv
        ON pv.variant_id = oi.variant_id
    INNER JOIN products AS p
        ON p.product_id = pv.product_id
    INNER JOIN categories AS c
        ON c.category_id = p.category_id
    WHERE o.payment_status = 'PAID'
      AND o.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL @report_days DAY)
    GROUP BY p.product_id, p.name, c.name
),
ranked_sales AS (
    SELECT
        paid_product_sales.*,
        RANK() OVER (ORDER BY revenue DESC) AS revenue_rank,
        AVG(revenue) OVER (PARTITION BY category_name) AS category_average_revenue
    FROM paid_product_sales
)
SELECT
    product_id,
    product_name,
    category_name,
    units_sold,
    order_count,
    ROUND(revenue, 2) AS revenue,
    revenue_rank,
    ROUND(category_average_revenue, 2) AS category_average_revenue,
    CASE
        WHEN revenue >= category_average_revenue THEN 'ABOVE_CATEGORY_AVERAGE'
        ELSE 'BELOW_CATEGORY_AVERAGE'
    END AS category_performance
FROM ranked_sales
ORDER BY revenue_rank, product_name
LIMIT 10;

-- 3) CTE + DENSE_RANK + NTILE + correlated subquery.
-- Customer value segmentation based on paid orders in the chosen reporting window.
WITH customer_spend AS (
    SELECT
        o.user_id,
        COUNT(DISTINCT o.order_id) AS paid_order_count,
        SUM(o.total_amount) AS total_spend,
        MAX(o.created_at) AS period_last_order
    FROM orders AS o
    WHERE o.payment_status = 'PAID'
      AND o.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL @report_days DAY)
    GROUP BY o.user_id
),
ranked_customers AS (
    SELECT
        u.user_id,
        u.full_name,
        u.email,
        customer_spend.paid_order_count,
        customer_spend.total_spend,
        customer_spend.period_last_order,
        DENSE_RANK() OVER (
            ORDER BY customer_spend.total_spend DESC
        ) AS spending_rank,
        NTILE(4) OVER (
            ORDER BY customer_spend.total_spend DESC
        ) AS value_quartile
    FROM customer_spend
    INNER JOIN users AS u
        ON u.user_id = customer_spend.user_id
    WHERE u.role = 'CUSTOMER'
)
SELECT
    user_id,
    full_name,
    email,
    paid_order_count,
    ROUND(total_spend, 2) AS total_spend,
    spending_rank,
    value_quartile,
    period_last_order,
    (
        SELECT MAX(o2.created_at)
        FROM orders AS o2
        WHERE o2.user_id = ranked_customers.user_id
          AND o2.payment_status = 'PAID'
    ) AS lifetime_last_paid_order
FROM ranked_customers
ORDER BY spending_rank, full_name
LIMIT 10;
