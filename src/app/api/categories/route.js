// EMBEDDED MYSQL: this Next.js route runs a SELECT with LEFT JOIN, COUNT and GROUP BY directly against MySQL. The route remains here so Next.js can register the HTTP endpoint.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await query(
      `SELECT
         c.category_id AS id,
         c.name,
         c.slug,
         c.description,
         COUNT(p.product_id) AS product_count
       FROM categories AS c
       LEFT JOIN products AS p
         ON p.category_id = c.category_id
        AND p.status = 'ACTIVE'
       WHERE c.is_active = 1
       GROUP BY c.category_id, c.name, c.slug, c.description
       ORDER BY c.name ASC`
    );

    return NextResponse.json(
      {
        categories: categories.map((category) => ({
          ...category,
          id: Number(category.id),
          product_count: Number(category.product_count),
        })),
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    console.error('[GET /api/categories] MySQL query failed:', error);
    return NextResponse.json(
      { error: 'Unable to load product categories.' },
      { status: 500 }
    );
  }
}
