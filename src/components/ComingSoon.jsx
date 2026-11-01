'use client';

import { useRouter } from 'next/navigation';

// Moved out of the old App.jsx so the three placeholder routes share one component.
function ComingSoon({ page }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">{page}</h1>
        <p className="text-light-gray">Coming Soon...</p>
        <button
          onClick={() => router.back()}
          className="mt-8 px-6 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default ComingSoon;
