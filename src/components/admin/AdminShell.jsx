'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Mail, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/messages', label: 'Contact inbox', icon: Mail },
];

export default function AdminShell({ title, description, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto max-w-[1480px] px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45 transition hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to store
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black tracking-[0.32em]">VAGE</span>
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">Admin</span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">{description}</p>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name || 'Administrator'}</p>
              <p className="text-xs text-white/45">{user?.email || 'Admin account'}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>

        <nav className="mb-8 flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition ${active
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/30 hover:text-white'}`}
              >
                <Icon className="h-4 w-4" /> {link.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
