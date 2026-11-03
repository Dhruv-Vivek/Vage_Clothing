import { query } from '@/lib/db';
import { LOW_STOCK_THRESHOLD, adminRoute, escapeLike } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const T = LOW_STOCK_THRESHOLD; // trusted integer constant

const BASE = `
  FROM product_variants AS pv
  JOIN products AS p ON p.product_id = pv.product_id
  LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
  WHERE pv.is_active = 1 AND p.status <> 'ARCHIVED'`;

export const GET = adminRoute(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const search = (sp.get('q') || '').trim().slice(0, 100);
  const filter = sp.get('filter') || 'all';
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(sp.get('limit')) || 25)));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (filter === 'out') where.push('COALESCE(i.stock_quantity, 0) = 0');
  if (filter === 'low') where.push(`COALESCE(i.stock_quantity, 0) <= ${T}`);
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push('(p.name LIKE ? OR pv.sku LIKE ? OR pv.color LIKE ? OR pv.size LIKE ?)');
    params.push(like, like, like, like);
  }
  const extra = where.length ? ` AND ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT pv.variant_id, pv.sku, pv.size, pv.color,
            p.product_id, p.name AS product_name, p.status AS product_status, p.image_url,
            COALESCE(i.stock_quantity, 0) AS stock
     ${BASE}${extra}
     ORDER BY stock ASC, p.name ASC, pv.variant_id ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${BASE}${extra}`, params);
  const [summary] = await query(
    `SELECT COUNT(*) AS variants,
            COALESCE(SUM(COALESCE(i.stock_quantity, 0) = 0), 0) AS out_of_stock,
            COALESCE(SUM(COALESCE(i.stock_quantity, 0) BETWEEN 1 AND ${T}), 0) AS low_stock,
            COALESCE(SUM(COALESCE(i.stock_quantity, 0)), 0) AS units
     ${BASE}`
  );

  return {
    items: rows.map((r) => ({
      variantId: Number(r.variant_id),
      sku: r.sku,
      size: r.size,
      color: r.color,
      productId: Number(r.product_id),
      productName: r.product_name,
      productStatus: r.product_status,
      imageUrl: r.image_url || null,
      stock: Number(r.stock),
    })),
    summary: {
      variants: Number(summary.variants),
      outOfStock: Number(summary.out_of_stock),
      lowStock: Number(summary.low_stock),
      units: Number(summary.units),
    },
    threshold: T,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    },
  };
});
