'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const emptyAddress = {
  label: 'Home',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateName: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

export default function SavedAddressesPage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadAddresses = useCallback(async () => {
    if (!isLoggedIn) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/account/addresses', { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load addresses.');
      setAddresses(body.addresses || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to load addresses.' });
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!authLoading) loadAddresses();
  }, [authLoading, loadAddresses]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const startNew = () => {
    setEditingId(null);
    setForm({ ...emptyAddress, isDefault: addresses.length === 0 });
    setShowForm(true);
    setNotice(null);
  };

  const startEdit = (address) => {
    setEditingId(address.id);
    setForm({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      stateName: address.stateName,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setShowForm(true);
    setNotice(null);
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(editingId ? '/api/account/addresses/' + editingId : '/api/account/addresses', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to save address.');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyAddress);
      setNotice({ type: 'success', text: editingId ? 'Address updated.' : 'Address saved.' });
      await loadAddresses();
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to save address.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (address) => {
    if (!window.confirm('Delete this saved address? Existing orders keep their original delivery address.')) return;
    setNotice(null);
    try {
      const response = await fetch('/api/account/addresses/' + address.id, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to delete address.');
      setNotice({ type: 'success', text: 'Address deleted.' });
      await loadAddresses();
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Unable to delete address.' });
    }
  };

  if (authLoading || loading) return <div className="min-h-[65vh] bg-dark pt-40 text-center text-light-gray">Loading saved addresses…</div>;
  if (!isLoggedIn) return <div className="min-h-[65vh] bg-dark px-4 pt-40 text-center text-light-gray">Sign in to manage saved addresses.</div>;

  return (
    <div className="min-h-screen bg-dark">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-light-gray">CUSTOMER SPACE</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Saved addresses</h1>
            <p className="mt-2 text-sm text-light-gray">Use these addresses for faster checkout. Previous orders keep their original address snapshot.</p>
          </div>
          {!showForm && (
            <button onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-black hover:bg-lighter-gray">
              <Plus className="h-4 w-4" /> Add address
            </button>
          )}
        </div>

        {notice && (
          <div role="status" className={'mb-6 flex gap-3 rounded-xl border p-4 ' +
            (notice.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-100' : 'border-red-500/30 bg-red-500/10 text-red-100')}>
            <AlertCircle className="h-5 w-5 shrink-0" /><p className="text-sm">{notice.text}</p>
          </div>
        )}

        {showForm && (
          <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={saveAddress}
            className="mb-8 rounded-2xl border border-dark-border bg-dark-secondary p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{editingId ? 'Edit address' : 'New address'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close address form"><X className="h-5 w-5 text-light-gray" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['label','Label','Home / Work / Other'],
                ['recipientName','Recipient name','Full name'],
                ['phone','Phone number','10 to 15 digits'],
                ['addressLine1','Address line 1','House number, street'],
                ['addressLine2','Address line 2 (optional)','Apartment, landmark'],
                ['city','City / District','City'],
                ['stateName','State / Region','State'],
                ['postalCode','Postal / PIN code','6-digit PIN for India'],
                ['country','Country','India'],
              ].map(([key,label,placeholder]) => (
                <div key={key} className={key === 'addressLine1' || key === 'addressLine2' ? 'sm:col-span-2' : ''}>
                  <label htmlFor={'address-' + key} className="mb-2 block text-sm text-white">{label}</label>
                  <input id={'address-' + key} required={!['addressLine2'].includes(key)}
                    maxLength={key === 'addressLine1' || key === 'addressLine2' ? 200 : key === 'recipientName' ? 120 : key === 'label' ? 40 : key === 'country' ? 80 : 100}
                    value={form[key]} onChange={(event) => update(key, event.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-dark-border bg-dark px-4 py-3 text-white outline-none focus:border-white" />
                </div>
              ))}
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm text-light-gray">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => update('isDefault', event.target.checked)} />
              Make this my default delivery address
            </label>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-black disabled:opacity-50">
                <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save address'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-dark-border px-6 py-3 text-white hover:border-white">Cancel</button>
            </div>
          </motion.form>
        )}

        {addresses.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-dark-border bg-dark-secondary p-10 text-center">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-light-gray" />
            <h2 className="text-xl font-semibold text-white">No saved addresses yet</h2>
            <p className="mt-2 text-sm text-light-gray">Add an address and it will be available during checkout.</p>
            <button onClick={startNew} className="mt-6 rounded-lg bg-white px-6 py-3 font-semibold text-black">Add your first address</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {addresses.map((address, index) => (
              <motion.article key={address.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><MapPin className="h-4 w-4 text-white" /></div>
                    <div><h2 className="font-semibold text-white">{address.label}</h2><p className="text-xs text-light-gray">{address.recipientName}</p></div>
                  </div>
                  {address.isDefault && <span className="rounded-full border border-green-500/30 px-3 py-1 text-[10px] tracking-wider text-green-300">DEFAULT</span>}
                </div>
                <p className="text-sm leading-6 text-light-gray">
                  {address.addressLine1}{address.addressLine2 ? ', ' + address.addressLine2 : ''}<br />
                  {address.city}, {address.stateName} {address.postalCode}<br />
                  {address.country}<br />{address.phone}
                </p>
                <div className="mt-5 flex gap-4 border-t border-dark-border pt-4">
                  <button onClick={() => startEdit(address)} className="inline-flex items-center gap-2 text-sm text-white hover:text-lighter-gray"><Pencil className="h-4 w-4" /> Edit</button>
                  <button onClick={() => deleteAddress(address)} className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"><Trash2 className="h-4 w-4" /> Delete</button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
