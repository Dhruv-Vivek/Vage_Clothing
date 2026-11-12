import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORTS = {
  newest: 'p.created_at DESC, p.product_id DESC',
  new: 'p.created_at DESC, p.product_id DESC',
  price_asc: 'vc.base_price ASC, p.product_id DESC',
  price_desc: 'vc.base_price DESC, p.product_id DESC',
  name: 'vc.name ASC, p.product_id DESC',
};

function toBooleanSearch(value) {
  return value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .map((token) => `+${token}*`)
    .join(' ');
}

function parsePrice(value, name) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
    throw new Error(`${name} must be a valid price between 0 and 1000000.`);
  }
  return parsed;
}

function mapProduct(row) {
  const price = Number(row.base_price);
  const stock = Number(row.total_stock || 0);
  return {
    id: Number(row.product_id),
    productId: Number(row.product_id),
    categoryId: Number(row.category_id),
    category: row.category_name,
    categorySlug: row.category_slug,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description || '',
    basePrice: price,
    price: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(price),
    image: row.image_url || null,
    imageUrl: row.image_url || null,
    status: row.status,
    specs: {
      material: row.material || 'Not specified',
      fit: row.fit_type || 'Not specified',
      origin: row.product_origin || 'Not specified',
    },
    variantCount: Number(row.variant_count || 0),
    availableStock: stock,
    inStock: stock > 0,
  };
}

export async function GET(request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const search = (searchParams.get('q') || '').trim().slice(0, 100);
    const category = (searchParams.get('category') || '').trim();
    const inStockOnly = searchParams.get('inStock') === '1';
    const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
    const limit = Math.min(48, Math.max(1, Math.floor(Number(searchParams.get('limit')) || 24)));
    const sortParam = searchParams.get('sort') || 'newest';
    const orderBy = SORTS[sortParam] || SORTS.newest;
    const minPrice = parsePrice(searchParams.get('minPrice'), 'minPrice');
    const maxPrice = parsePrice(searchParams.get('maxPrice'), 'maxPrice');

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return NextResponse.json(
        { error: 'minPrice cannot be greater than maxPrice.' },
        { status: 400 }
      );
    }

    const where = [
      "vc.status = 'ACTIVE'",
      'c.is_active = 1',
    ];
    const params = [];

    if (category && category.toLowerCase() !== 'all') {
      if (/^\d+$/.test(category)) {
        where.push('vc.category_id = ?');
        params.push(Number(category));
      } else {
        where.push('c.slug = ?');
        params.push(category.toLowerCase());
      }
    }

    if (search) {
      const booleanSearch = toBooleanSearch(search);
      if (booleanSearch) {
        where.push(`(
          MATCH(p.name, p.description, p.brand) AGAINST (? IN BOOLEAN MODE)
          OR p.name LIKE ?
          OR p.description LIKE ?
          OR p.brand LIKE ?
        )`);
        params.push(booleanSearch, `%${search}%`, `%${search}%`, `%${search}%`);
      } else {
        where.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
    }

    if (minPrice !== null) {
      where.push('vc.base_price >= ?');
      params.push(minPrice);
    }

    if (maxPrice !== null) {
      where.push('vc.base_price <= ?');
      params.push(maxPrice);
    }

    if (inStockOnly) {
      where.push('vc.total_stock > 0');
    }

    const whereSql = where.join(' AND ');
    const fromSql = `
      FROM v_product_catalog AS vc
      INNER JOIN products AS p ON p.product_id = vc.product_id
      INNER JOIN categories AS c ON c.category_id = vc.category_id
    `;

    let orderSql = orderBy;
    const listParams = [...params];
    if (search && toBooleanSearch(search)) {
      orderSql = `MATCH(p.name, p.description, p.brand) AGAINST (? IN BOOLEAN MODE) DESC, ${orderBy}`;
      // ORDER BY placeholders follow all WHERE placeholders in SQL text.
      listParams.push(toBooleanSearch(search));
    }

    const products = await query(
      `SELECT vc.*, c.slug AS category_slug, p.created_at,
              COUNT(*) OVER() AS filtered_total
       ${fromSql}
       WHERE ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`,
      [...listParams, limit, (page - 1) * limit]
    );

    // Window COUNT returns the filtered total with each product row,
    // avoiding a second round trip for normal pages. Fall back only when
    // the requested page is empty (for example, a stale page number).
    const total = products.length
      ? Number(products[0].filtered_total)
      : Number((await query(
          `SELECT COUNT(*) AS total
           ${fromSql}
           WHERE ${whereSql}`,
          params
        ))[0]?.total || 0);

    return NextResponse.json(
      {
        products: products.map(mapProduct),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
        filters: {
          q: search || null,
          category: category || null,
          minPrice,
          maxPrice,
          inStock: inStockOnly,
          sort: sortParam,
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    if (error instanceof Error && /must be a valid price/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[GET /api/products] MySQL query failed:', error);
    return NextResponse.json(
      { error: 'Unable to load products.' },
      { status: 500 }
    );
  }
}
