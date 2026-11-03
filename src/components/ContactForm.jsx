'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const initialForm = { fullName: '', email: '', phone: '', subject: '', message: '', website: '' };

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to send your message.');
      setNotice({ type: 'success', text: body.message || 'Your message has been received.' });
      setForm(initialForm);
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <section className="pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
            <p className="text-light-gray text-xs tracking-[0.35em] uppercase mb-4">VAGE Customer Care</p>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-5">Get in Touch</h1>
            <p className="max-w-2xl mx-auto text-light-gray leading-7">
              Questions about an order, product or membership? Send the VAGE team a message and we’ll get back to you.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-8">
            <motion.aside initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="bg-dark-secondary border border-dark-border rounded-2xl p-7 h-fit">
              <h2 className="text-white text-xl font-semibold mb-7">Customer Support</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <span className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center"><Mail className="w-5 h-5 text-white"/></span>
                  <div><p className="text-white font-medium">Email</p><p className="text-light-gray text-sm mt-1">Use the contact form to reach our support inbox.</p></div>
                </div>
                <div className="flex gap-4">
                  <span className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center"><Phone className="w-5 h-5 text-white"/></span>
                  <div><p className="text-white font-medium">Phone</p><p className="text-light-gray text-sm mt-1">Add a support number when one is available.</p></div>
                </div>
                <div className="flex gap-4">
                  <span className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center"><MapPin className="w-5 h-5 text-white"/></span>
                  <div><p className="text-white font-medium">Location</p><p className="text-light-gray text-sm mt-1">Online customer support</p></div>
                </div>
              </div>
              <div className="mt-9 border-t border-dark-border pt-6">
                <p className="text-light-gray text-sm leading-6">Messages are saved securely in VAGE’s database. A notification is sent to the dedicated VAGE mailbox.</p>
              </div>
            </motion.aside>

            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="bg-dark-secondary border border-dark-border rounded-2xl p-7 sm:p-9">
              <h2 className="text-white text-2xl font-semibold mb-2">Send us a message</h2>
              <p className="text-light-gray text-sm mb-7">Fields marked with * are required.</p>

              {notice && (
                <div role="status" className={`mb-6 rounded-lg border p-4 flex gap-3 ${notice.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
                  {notice.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0"/> : <AlertCircle className="w-5 h-5 flex-shrink-0"/>}
                  <p className="text-sm">{notice.text}</p>
                </div>
              )}

              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm text-white mb-2">Full name *</label>
                    <input id="contact-name" required minLength={2} maxLength={120} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" placeholder="Your name"/>
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm text-white mb-2">Email address *</label>
                    <input id="contact-email" required type="email" maxLength={190} value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" placeholder="you@example.com"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-phone" className="block text-sm text-white mb-2">Phone (optional)</label>
                    <input id="contact-phone" type="tel" maxLength={30} value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" placeholder="+91"/>
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block text-sm text-white mb-2">Subject *</label>
                    <input id="contact-subject" required minLength={3} maxLength={160} value={form.subject} onChange={(e) => update('subject', e.target.value)} className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" placeholder="How can we help?"/>
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm text-white mb-2">Message *</label>
                  <textarea id="contact-message" required minLength={10} maxLength={5000} rows={6} value={form.message} onChange={(e) => update('message', e.target.value)} className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white resize-y" placeholder="Write your message..."/>
                </div>
                <div aria-hidden="true" className="hidden">
                  <label htmlFor="contact-website">Leave this field empty</label>
                  <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update('website', e.target.value)}/>
                </div>
                <button type="submit" disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-lighter-gray transition-all disabled:opacity-50">
                  {busy ? <><Loader2 className="w-5 h-5 animate-spin"/> Sending…</> : <><Send className="w-5 h-5"/> Send Message</>}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
