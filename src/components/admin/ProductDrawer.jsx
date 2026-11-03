'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
  Drawer,
  Field,
  Thumb,
  api,
  ghostButton,
  inputClass,
  primaryButton,
} from './ui';

const EMPTY = {
  name: '',
  categoryId: '',
  brand: 'Vage',
  description: '',
  basePrice: '',
  status: 'DRAFT',
  imageUrl: '',
  material: '',
  fitType: '',
  productOrigin: '',
};

const splitList = (text) =>
  [...new Set(text.split(',').map((item) => item.trim()).filter(Boolean))];

export default function ProductDrawer({ open, productId, categories, onClose, onSaved }) {
  const isEdit = productId !== null;
  const [form, setForm] = useState(EMPTY);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // Create-mode variant generator
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [startStock, setStartStock] = useState('0');
  // Edit-mode "add variant" row
  const [newVariant, setNewVariant] = useState({ size: '', color: '', stock: '0' });
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSizes('');
    setColors('');
    setStartStock('0');
    setNewVariant({ size: '', color: '', stock: '0' });
    if (!isEdit) {
      setForm(EMPTY);
      setVariants([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api(`/api/admin/products/${productId}`)
      .then(({ product, variants: list }) => {
        if (cancelled) return;
        setForm({
          name: product.name,
          categoryId: String(product.categoryId),
          brand: product.brand,
          description: product.description,
          basePrice: String(product.basePrice),
          status: product.status,
          imageUrl: product.imageUrl || '',
          material: product.material,
          fitType: product.fitType,
          productOrigin: product.productOrigin,
        });
        setVariants(list);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, productId, isEdit]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await api('/api/admin/upload', { method: 'POST', formData });
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.categoryId) return setError('Choose a category.');
    setSaving(true);
    try {
      const body = { ...form, categoryId: Number(form.categoryId), basePrice: form.basePrice };
      if (isEdit) {
        await api(`/api/admin/products/${productId}`, { method: 'PATCH', body });
        onSaved('Product saved');
      } else {
        const sizeList = splitList(sizes);
        const colorList = splitList(colors);
        if ((sizeList.length === 0) !== (colorList.length === 0)) {
          throw new Error('Enter both sizes and colours, or leave both empty to add variants later.');
        }
        body.variants = sizeList.flatMap((size) =>
          colorList.map((color) => ({ size, color, stock: startStock || '0' }))
        );
        await api('/api/admin/products', { method: 'POST', body });
        onSaved('Product created');
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVariant = async (variant) => {
    try {
      await api(`/api/admin/variants/${variant.variantId}`, {
        method: 'PATCH',
        body: { isActive: !variant.isActive },
      });
      setVariants((list) =>
        list.map((v) => (v.variantId === variant.variantId ? { ...v, isActive: !v.isActive } : v))
      );
      onSaved(variant.isActive ? 'Variant hidden from store' : 'Variant restored');
    } catch (err) {
      setError(err.message);
    }
  };

  const addVariant = async () => {
    setError('');
    try {
      const { variant } = await api(`/api/admin/products/${productId}/variants`, {
        method: 'POST',
        body: newVariant,
      });
      setVariants((list) => [...list, variant]);
      setNewVariant({ size: '', color: '', stock: '0' });
      onSaved('Variant added');
    } catch (err) {
      setError(err.message);
    }
  };

  const comboCount = splitList(sizes).length * splitList(colors).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : 'New product'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="product-form" className={primaryButton} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-light-gray">Loading…</p>
      ) : (
        <form id="product-form" onSubmit={save} className="space-y-5">
          {error ? (
            <p role="alert" className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <Field label="Name">
            <input className={inputClass} value={form.name} onChange={set('name')} maxLength={180} required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className={inputClass} value={form.categoryId} onChange={set('categoryId')} required>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand">
              <input className={inputClass} value={form.brand} onChange={set('brand')} maxLength={100} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (₹)">
              <input
                className={inputClass}
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                inputMode="decimal"
                value={form.basePrice}
                onChange={set('basePrice')}
                required
              />
            </Field>
            <Field label="Status" hint="Only Active products show in the store.">
              <select className={inputClass} value={form.status} onChange={set('status')}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea className={`${inputClass} min-h-[6rem]`} value={form.description} onChange={set('description')} maxLength={5000} />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Material">
              <input className={inputClass} value={form.material} onChange={set('material')} maxLength={100} />
            </Field>
            <Field label="Fit">
              <input className={inputClass} value={form.fitType} onChange={set('fitType')} maxLength={60} />
            </Field>
            <Field label="Origin">
              <input className={inputClass} value={form.productOrigin} onChange={set('productOrigin')} maxLength={80} />
            </Field>
          </div>

          <Field label="Image" hint="JPG, PNG or WebP, up to 4 MB. Or paste a path/URL.">
            <div className="flex items-center gap-3">
              <Thumb src={form.imageUrl} alt="Product preview" />
              <input
                className={inputClass}
                value={form.imageUrl}
                onChange={set('imageUrl')}
                placeholder="/products/hoodie1.jpg"
                maxLength={255}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id="product-image-file"
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <label
                htmlFor="product-image-file"
                className={`${ghostButton} cursor-pointer whitespace-nowrap`}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Upload
              </label>
            </div>
          </Field>

          {/* Variants */}
          {isEdit ? (
            <section aria-labelledby="variants-heading">
              <h3 id="variants-heading" className="mb-2 text-sm font-medium">
                Variants
              </h3>
              <p className="mb-3 text-xs text-light-gray">
                Change stock levels on the Inventory page. Hiding a variant removes it from the store but keeps order history.
              </p>
              <div className="overflow-hidden rounded-lg border border-dark-border">
                {variants.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-light-gray">No variants yet. Add one below so customers can buy this.</p>
                ) : (
                  <ul className="divide-y divide-dark-border text-sm">
                    {variants.map((v) => (
                      <li key={v.variantId} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className={v.isActive ? '' : 'opacity-50'}>
                          <span className="font-medium">
                            {v.size} · {v.color}
                          </span>
                          <span className="block text-xs text-light-gray">
                            {v.sku} · {v.stock} in stock
                          </span>
                        </div>
                        <button type="button" onClick={() => toggleVariant(v)} className="text-xs text-light-gray underline hover:text-white">
                          {v.isActive ? 'Hide' : 'Restore'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2">
                <Field label="Size">
                  <input className={inputClass} value={newVariant.size} onChange={(e) => setNewVariant((n) => ({ ...n, size: e.target.value }))} maxLength={32} />
                </Field>
                <Field label="Colour">
                  <input className={inputClass} value={newVariant.color} onChange={(e) => setNewVariant((n) => ({ ...n, color: e.target.value }))} maxLength={64} />
                </Field>
                <Field label="Stock">
                  <input className={inputClass} type="number" min="0" value={newVariant.stock} onChange={(e) => setNewVariant((n) => ({ ...n, stock: e.target.value }))} />
                </Field>
                <button type="button" className={ghostButton} onClick={addVariant} disabled={!newVariant.size.trim() || !newVariant.color.trim()}>
                  Add
                </button>
              </div>
            </section>
          ) : (
            <section aria-labelledby="variants-heading" className="rounded-lg border border-dark-border p-4">
              <h3 id="variants-heading" className="mb-1 text-sm font-medium">
                Sizes and colours
              </h3>
              <p className="mb-3 text-xs text-light-gray">
                Separate with commas. Every size is created in every colour, each starting with the stock below.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sizes">
                  <input className={inputClass} value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" />
                </Field>
                <Field label="Colours">
                  <input className={inputClass} value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Black, Charcoal" />
                </Field>
              </div>
              <div className="mt-4 flex items-end gap-4">
                <div className="w-32">
                  <Field label="Stock each">
                    <input className={inputClass} type="number" min="0" value={startStock} onChange={(e) => setStartStock(e.target.value)} />
                  </Field>
                </div>
                <p className="pb-2 text-xs text-light-gray">
                  {comboCount > 0 ? `${comboCount} variant${comboCount === 1 ? '' : 's'} will be created` : 'Optional. You can add variants after saving.'}
                </p>
              </div>
            </section>
          )}
        </form>
      )}
    </Drawer>
  );
}
