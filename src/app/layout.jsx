import '../index.css';
import Providers from '../components/Providers';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'VAGE | Clothing',
  description: 'VAGE: dark, premium clothing. Hoodies, tees, bottoms, shoes and outerwear.',
};

export const viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>
          {/* Navbar and Footer live here once instead of inside every page. The Navbar is
              position:fixed, so it looks exactly as before; the footer is pushed to the bottom. */}
          <div className="flex min-h-screen flex-col bg-dark">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
