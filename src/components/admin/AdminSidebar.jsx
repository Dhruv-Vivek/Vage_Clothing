'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, LayoutDashboard, LogOut, Mail, ShoppingBag, Shirt, Store, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', icon: Shirt },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/orders', label: 'Orders & returns', icon: ShoppingBag },
];
const COMING = [
  { label: 'Customers', icon: Users },
  { label: 'Messages', icon: Mail },
];

export default function AdminSidebar({ name }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const itemClass = (active) =>
    `flex flex-none items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-white text-black' : 'text-light-gray hover:bg-dark-secondary hover:text-white'
    }`;

  return (
    <aside className="border-b border-dark-border bg-dark md:fixed md:inset-y-0 md:left-0 md:flex md:w-60 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-baseline gap-2 px-4 pb-2 pt-4 md:px-5 md:pb-6 md:pt-6">
        <span className="text-xl font-bold tracking-wider">VAGE</span>
        <span className="text-sm text-light-gray">Admin</span>
      </div>

      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {NAV.map((item) => {
          const { href, label, exact } = item;
          const Icon = item.icon;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}

        {COMING.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="hidden items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 md:flex"
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <span className="ml-auto text-xs">soon</span>
            </span>
          );
        })}

        <div className="flex gap-1 md:mt-auto md:flex-col md:border-t md:border-dark-border md:pt-3">
          <Link href="/" className={itemClass(false)}>
            <Store className="h-4 w-4" />
            View store
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
            className={itemClass(false)}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </nav>

      <p className="hidden truncate px-5 pb-5 pt-2 text-xs text-light-gray md:block">Signed in as {name}</p>
    </aside>
  );
}
