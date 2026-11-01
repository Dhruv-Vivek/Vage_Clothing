import Link from 'next/link';

// Dark 404 in the same style as the existing "Product Not Found" screen
// (without this, Next.js would show its default white 404 page).
export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Page Not Found</h1>
        <p className="text-light-gray">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="mt-8 inline-block px-6 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
