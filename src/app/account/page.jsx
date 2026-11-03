'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserRound, MapPin, Package, Crown, ShieldCheck, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AccountPage() {
  const { user, isLoggedIn, isLoading: authLoading, refresh } = useAuth();
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/account/profile', { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load your profile.');
      setProfile({
        fullName: body.profile.fullName || '',
        email: body.profile.email || '',
        phone: body.profile.phone || '',
      });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to load profile.' });
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!authLoading) loadProfile();
  }, [authLoading, loadProfile]);

  const update = (field, value) => setProfile((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(profile),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to update profile.');
      setProfile({
        fullName: body.profile.fullName,
        email: body.profile.email,
        phone: body.profile.phone || '',
      });
      await refresh();
      setNotice({ type: 'success', text: body.message || 'Profile saved.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-[70vh] bg-dark pt-40 text-center text-light-gray">Loading your account…</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[70vh] bg-dark px-4 pt-40 text-center">
        <UserRound className="mx-auto mb-5 h-12 w-12 text-light-gray" />
        <h1 className="text-3xl font-bold text-white">Your VAGE account</h1>
        <p className="mt-3 text-light-gray">Sign in to manage your profile, addresses, wishlist and orders.</p>
      </div>
    );
  }

  const links = [
    { href: '/account/orders', title: 'My orders', description: 'View purchases, payment status and delivery progress.', icon: Package },
    { href: '/account/addresses', title: 'Saved addresses', description: 'Manage delivery addresses for faster checkout.', icon: MapPin },
    { href: '/membership', title: 'Membership', description: 'Review your benefits, active plan and renewal history.', icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-dark">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="text-xs tracking-[0.3em] text-light-gray">CUSTOMER SPACE</p>
          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">My Account</h1>
          <p className="mt-3 text-light-gray">Manage your VAGE profile and shopping activity.</p>
        </motion.div>

        {notice && (
          <div role="status" className={'mb-6 flex gap-3 rounded-xl border p-4 ' +
            (notice.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-100' : 'border-red-500/30 bg-red-500/10 text-red-100')}>
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{notice.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6 md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-light-gray" />
              <h2 className="text-2xl font-semibold text-white">Profile details</h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-5">
              <div>
                <label htmlFor="account-name" className="mb-2 block text-sm text-white">Full name</label>
                <input id="account-name" required minLength={2} maxLength={120} value={profile.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  className="w-full rounded-lg border border-dark-border bg-dark px-4 py-3 text-white outline-none focus:border-white" />
              </div>
              <div>
                <label htmlFor="account-email" className="mb-2 block text-sm text-white">Email address</label>
                <input id="account-email" type="email" required maxLength={190} value={profile.email}
                  onChange={(event) => update('email', event.target.value)}
                  className="w-full rounded-lg border border-dark-border bg-dark px-4 py-3 text-white outline-none focus:border-white" />
                <p className="mt-2 text-xs text-light-gray">Order updates are sent to the email address saved on each order.</p>
              </div>
              <div>
                <label htmlFor="account-phone" className="mb-2 block text-sm text-white">Phone number</label>
                <input id="account-phone" type="tel" maxLength={18} value={profile.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  placeholder="+91"
                  className="w-full rounded-lg border border-dark-border bg-dark px-4 py-3 text-white outline-none focus:border-white" />
              </div>
              <button type="submit" disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-black transition hover:bg-lighter-gray disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            {links.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.href} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }}>
                  <Link href={item.href} className="group flex gap-4 rounded-2xl border border-dark-border bg-dark-secondary p-6 transition hover:border-white/50">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm text-light-gray">{item.description}</p>
                    </div>
                    <span className="self-center text-xl text-light-gray transition group-hover:translate-x-1 group-hover:text-white">→</span>
                  </Link>
                </motion.div>
              );
            })}
            <div className="rounded-2xl border border-dark-border p-5 text-sm text-light-gray">
              <ShieldCheck className="mb-2 h-5 w-5 text-light-gray" />
              Signed in as <span className="font-medium text-white">{user?.email}</span>. Account updates are saved securely to VAGE's MySQL database.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
