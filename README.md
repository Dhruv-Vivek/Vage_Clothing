# Vage Clothing

A dark, premium clothing e-commerce web application, migrated from Vite + React Router to **Next.js (App Router)**.

> Migration status: **Phase 3A, Batch 1**. The UI is fully migrated and still reads the static product data in
> `src/data/products.js`. MySQL, MongoDB and real authentication are connected in the next batches.

## Tech stack

- Next.js 15 (App Router) and React 19
- Tailwind CSS 3
- Framer Motion
- Lucide React

## Project structure

```
src/
├── app/            App Router: layout.jsx plus one folder per route
├── components/     Navbar, Footer, ProductCard, ProductShowcase, ui/ (3D card, beams, spotlight...)
├── context/        AuthContext, CartContext (client-side providers)
├── data/           Static product data (temporary, replaced by MySQL in Batch 2)
└── lib/            Shared helpers
public/
├── hero-video.mp4
└── products/       Product images
```

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # run the production build
```

## Routes

| Route | Page |
|---|---|
| `/` | Home (hero video, premium collection, features) |
| `/products`, `/products/[id]` | Catalogue and product detail |
| `/cart`, `/checkout`, `/order-success` | Shopping flow |
| `/membership` | Membership plans |
| `/about`, `/contact`, `/favorites` | Placeholders (coming soon) |
