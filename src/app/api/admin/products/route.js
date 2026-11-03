import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  HttpError,
  LOW_STOCK_THRESHOLD,
  PRODUCT_STATUSES,
  adminRoute,
  escapeLike,
  readJson,
  run,
  withTransaction,
} from '@/lib/admin';
import {
  insertVariant,
  loadProduct,
  parseProductBody,
  parseVariantBody,
  uniqueSlug,
} from '@/lib/admin-products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_INITIAL_VARIANTS = 60;

export const GET = adminRoute(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const search = (sp.get('q') || '').trim().slice(0, 100);
  const status = (sp.get('status') || 'all').toUpperCase();
  const category = (sp.get('category') || '').trim();
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(sp.get('limit')) || 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (PRODUCT_STATUSES.includes(status)) {
    where.push('p.status = ?');
    params.push(status);
  }
  if (/^\d+$/.test(category)) {
    where.push('p.category_id = ?');
    params.push(Number(category));
  }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push(`(p.name LIKE ? OR p.brand LIKE ? OR EXISTS (
      SELECT 1 FROM product_variants AS x WHERE x.product_id = p.product_id AND x.sku LIKE ?
    ))`);
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // limit/offset/threshold are validated integers, so they are inlined (avoids mysql2 prepared LIMIT quirks).
  const rows = await query(
    `SELECT p.product_id, p.name, p.slug, p.brand, p.base_price, p.status, p.image_url,
            c.category_id, c.name AS category_name,
            COALESCE(v.variant_count, 0) AS variant_count,
            COALESCE(v.total_stock, 0)   AS total_stock,
            COALESCE(v.low_variants, 0)  AS low_variants
       FROM products AS p
       JOIN categories AS c ON c.category_id = p.category_id
       LEFT JOIN (
         SELECT pv.product_id,
                COUNT(*) AS variant_count,
                SUM(COALESCE(i.stock_quantity, 0)) AS total_stock,
                SUM(COALESCE(i.stock_quantity, 0) <= ${LOW_STOCK_THRESHOLD}) AS low_variants
           FROM product_variants AS pv
           LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
          WHERE pv.is_active = 1
          GROUP BY pv.product_id
       ) AS v ON v.product_id = p.product_id
       ${whereSql}
      ORDER BY p.created_at DESC, p.product_id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM products AS p ${whereSql}`,
    params
  );
  const statusRows = await query('SELECT status, COUNT(*) AS n FROM products GROUP BY status');
  const counts = { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 };
  for (const row of statusRows) counts[row.status] = Number(row.n);

  return {
    products: rows.map((row) => ({
      id: Number(row.product_id),
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      categoryId: Number(row.category_id),
      category: row.category_name,
      basePrice: Number(row.base_price),
      status: row.status,
      imageUrl: row.image_url || null,
      variantCount: Number(row.variant_count),
      totalStock: Number(row.total_stock),
      lowVariants: Number(row.low_variants),
    })),
    counts,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    },
  };
});

export const POST = adminRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const fields = parseProductBody(body);

  const variantInputs = Array.isArray(body.variants) ? body.variants : [];
  if (variantInputs.length > MAX_INITIAL_VARIANTS) {
    throw new HttpError(400, `Add at most ${MAX_INITIAL_VARIANTS} variants at once.`);
  }
  const variants = variantInputs.map((v) => {
    if (!v || typeof v !== 'object') throw new HttpError(400, 'Each variant must be an object.');
    return parseVariantBody(v);
  });

  const productId = await withTransaction(async (connection) => {
    const slug = await uniqueSlug(connection, fields.name);
    const result = await run(
      connection,
      `INSERT INTO products
         (category_id, name, slug, brand, description, base_price, status, image_url,
          material, fit_type, product_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.category_id,
        fields.name,
        slug,
        fields.brand,
        fields.description,
        fields.base_price,
        fields.status,
        fields.image_url,
        fields.material,
        fields.fit_type,
        fields.product_origin,
      ]
    );
    const id = Number(result.insertId);
    for (const variant of variants) {
      await insertVariant(connection, id, variant, user.id);
    }
    return id;
  });

  return NextResponse.json(await loadProduct(productId), { status: 201 });
});
