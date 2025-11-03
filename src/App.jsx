import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Membership from './pages/Membership';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/membership" element={<Membership />} />
        
        {/* Placeholder routes - create these pages later */}
        <Route path="/about" element={<ComingSoon page="About Us" />} />
        <Route path="/contact" element={<ComingSoon page="Contact" />} />
        <Route path="/favorites" element={<ComingSoon page="Favorites" />} />
      </Routes>
    </Router>
  );
}

// Simple Coming Soon component for placeholder pages
function ComingSoon({ page }) {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">{page}</h1>
        <p className="text-light-gray">Coming Soon...</p>
        <button
          onClick={() => window.history.back()}
          className="mt-8 px-6 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default App;