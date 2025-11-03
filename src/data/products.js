export const products = [
  {
    id: 1,
    name: "Urban Tee",
    category: "T-Shirts",
    price: "₹2,000",
    image: "/products/urban-tee.jpg",
    specs: {
      material: "Premium Cotton",
      fit: "Regular Fit",
      origin: "Sustainable"
    }
  },
  {
    id: 2,
    name: "Gothic Shoes",
    category: "Shoes",
    price: "₹4,000",
    image: "/products/gothic-shoes.jpg",
    specs: {
      material: "Leather",
      fit: "True to Size",
      origin: "Handcrafted"
    }
  },
  {
    id: 3,
    name: "Essential Hoodie",
    category: "Hoodies",
    price: "₹3,000",
    image: "/products/essential-hoodie.jpg",
    specs: {
      material: "Cotton Blend",
      fit: "Relaxed Fit",
      origin: "Ethically Made"
    }
  },
  {
    id: 4,
    name: "Classic Denim",
    category: "Bottoms",
    price: "₹1,900",
    image: "/products/classic-denim.jpg",
    specs: {
      material: "Denim",
      fit: "Slim Fit",
      origin: "Sustainable"
    }
  },
  {
    id: 5,
    name: "Comfort Hoodie",
    category: "Hoodies",
    price: "₹3,000",
    image: "/products/comfort-hoodie.jpg",
    specs: {
      material: "Premium Cotton",
      fit: "Oversized",
      origin: "Ethically Made"
    }
  },
  {
    id: 6,
    name: "Premium Coat",
    category: "Outerwear",
    price: "₹5,000",
    image: "/products/premium-coat.jpg",
    specs: {
      material: "Wool Blend",
      fit: "Regular Fit",
      origin: "Premium"
    }
  },


  {
    id:7,
    name:"Long Skirt",
    category:"Outerwear",
    price:"13750",
    image:"/products/long-skirt.jpg",
    specs:{
        material:"Satin",
        fit:"Regular Fit",
        origin:"Gothic",
    }
  },
  {
    id:8,
    name:"Mini Skirt",
    category:"Outerwear",
    price:"1750",
    image:"/products/skirt.jpg",
    specs:{
        material:"Satin",
        fit:"Regular Fit",
        origin:"Gothic",
    }
  },
  {
    id: 9,
    name: "Leather Shoes",
    category: "Shoes",
    price: "₹2500",
    image: "/products/leather-boots.jpg",
    specs:{
        material:"Leather",
        fit:"High Boots",
        origin:"Gothic",
    }
  },
  {
    id: 10,
    name: "Printed Shirt",
    category: "T-Shirts",
    price: "₹1099",
    image: "/products/printed-tee.jpg",
    specs:{
        material:"Premuim Cotton",
        fit:"Relaxed",
        origin:"Printed",
    }
  },
  {
    id: 11,
    name: "Heels-Female",
    category: "Shoes",
    price: "₹2499",
    image: "/products/heels.jpg",
    specs:{
        material:"Premuim Imported Leather",
        fit:"Relaxed",
        origin:"Eco",
    }
  },
  {
    id: 12,
    name: "Gothic Baggy Cargo",
    category: "Bottoms",
    price: "₹2799",
    image: "/products/pants.jpg",
    specs:{
        material:"COTTON, CHAINS",
        fit:"Baggy",
        origin:"Handcrafted",
    }
  },
  {
    id: 13,
    name: "Reversible Skull Sweatpants",
    category: "Bottoms",
    price: "₹2799",
    image: "/products/pant2.jpg",
    specs:{
        material:"Premium Cotton",
        fit:"Baggy",
        origin:"Handcrafted",
    }
  },
  {
    id: 14,
    name: "Hoodie-Female",
    category: "Hoodies",
    price: "₹3,339",
    image: "/products/hoodie1.jpg",
    specs:{
        material:"Premium Cotton",
        fit:"Baggy",
        origin:"Handcrafted",
    }
  },
  {
    id: 15,
    name: "Printed Shirt-Female",
    category: "T-Shirts",
    price: "₹1,399",
    image: "/products/tee1.jpg",
    specs:{
        material:"Premuim Cotton",
        fit:"Relaxed",
        origin:"Printed",
    }
  },
];

export const premiumCollection = [
  {
    id: 101,
    name: "CLASSICAL PREMIUM TEE",
    description: "The foundation of every wardrobe. Our classical premium tee is crafted from the finest organic cotton, offering a perfect blend of comfort and style. Designed to last, this versatile piece transitions seamlessly from casual to refined.",
    price: "₹3,500",
    image: "/products/premium-tee.jpg",
    specs: {
      material: "100% Organic Cotton",
      fit: "Regular Fit",
      origin: "Sustainable"
    }
  },
  {
    id: 102,
    name: "PREMIUM HOODIE",
    description: "Our signature hoodie combines premium cotton blend with contemporary design. Perfect for layering or wearing solo, this piece offers unmatched comfort and versatility. Made from sustainable materials with attention to every detail.",
    price: "₹2,500",
    image: "/products/premium-hoodie.jpg",
    specs: {
      material: "Premium Cotton Blend",
      fit: "Relaxed Fit",
      origin: "Ethically Made"
    }
  }
];

export const categories = ["All", "T-Shirts", "Shoes", "Hoodies", "Bottoms", "Outerwear"];

export const features = [
  {
    title: "Premium Quality",
    description: "Crafted with the finest materials",
    icon: "quality"
  },
  {
    title: "Sustainable",
    description: "Eco-friendly production process",
    icon: "sustainable"
  },
  {
    title: "Timeless Design",
    description: "Classic styles that never fade",
    icon: "design"
  }
];
export const membershipPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 599,
    period: 'year',
    discount: 10,
    freeShipping: 2000,
    features: [
      '10% discount on all products',
      'Free shipping on orders above ₹2000',
      'Priority email support',
      'Access to member-only sales'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 1299,
    period: 'year',
    discount: 20,
    freeShipping: 0,
    recommended: true,
    features: [
      '20% discount on all products',
      'Free shipping on all orders',
      'Early access to new collections',
      '24/7 priority support',
      'Birthday special offers'
    ]
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 1599,
    period: 'year',
    discount: 30,
    freeShipping: 0,
    features: [
      '30% discount on all products',
      'Free express shipping worldwide',
      'Exclusive limited edition access',
      'Personal style consultant',
      'VIP events and launches',
      'Priority customer service'
    ]
  }
];

export const deliveryOptions = [
  {
    id: 'standard',
    name: 'Standard Delivery',
    days: '5-6 days',
    price: 99,
    memberPrice: 'FREE'
  },
  {
    id: 'express',
    name: 'Express Delivery',
    days: '3-4 days',
    price: 199,
    memberPrice: 'FREE'
  },
  {
    id: 'priority',
    name: 'Priority Delivery',
    days: '1-2 days',
    price: 250,
    memberPrice: 'FREE'
  }
];