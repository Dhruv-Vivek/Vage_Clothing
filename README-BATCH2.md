# Vage Clothing — Batch 2: MySQL Catalogue Integration

This overlay adds a server-only MySQL connection pool and read-only category/product APIs, then connects the existing homepage, catalogue, product detail page, and navbar search to the APIs. The existing dark Vage styling and Framer Motion components are retained.

## Files in this overlay

New:
- `src/lib/db.js`
- `src/app/api/categories/route.js`
- `src/app/api/products/route.js`
- `src/app/api/products/[id]/route.js`
- `.env.example`

Updated:
- `src/app/page.jsx`
- `src/app/products/page.jsx`
- `src/app/products/[id]/page.jsx`
- `src/components/Navbar.jsx`

## Install dependencies

From the repository root:

```powershell
npm install mysql2 server-only
```

## Configure the database

Copy `.env.example` to `.env.local` and fill in the MySQL password locally. Do not commit `.env.local`.

```powershell
Copy-Item .env.example .env.local
```

Expected local configuration:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_LOCAL_MYSQL_ROOT_PASSWORD
DB_NAME=vage_clothing
DB_CONNECTION_LIMIT=10
```

## Start and test

```powershell
npm run dev
```

In a browser, test:

- `http://localhost:3000/api/categories`
- `http://localhost:3000/api/products`
- `http://localhost:3000/api/products?category=t-shirts`
- `http://localhost:3000/api/products?q=urban`
- `http://localhost:3000/api/products?sort=price_asc`
- `http://localhost:3000/api/products?minPrice=1000&maxPrice=3000`
- `http://localhost:3000/api/products/1`
- `http://localhost:3000/api/products/999999` (should return HTTP 404)

The product listing endpoint supports `q`, `category` (slug or numeric category ID), `minPrice`, `maxPrice`, `inStock=1`, `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page`, and `limit` (maximum 48).

## Database safety

All Batch 2 endpoints are read-only. They do not write to or modify the MySQL database. They use the existing `v_product_catalog` view and the existing tables `products`, `categories`, `product_variants`, and `inventory`. No schema changes or SQL seed scripts are included.

Product detail responses include variant and stock data, but selecting a variant and storing `variant_id` in the cart is reserved for the later cart integration batch. The current localStorage cart remains unchanged in this batch.
