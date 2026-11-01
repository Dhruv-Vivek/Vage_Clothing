'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

function LoginModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const closeModal = () => {
    if (isSubmitting) return;
    setError('');
    setFormData(EMPTY_FORM);
    setMode('login');
    onClose();
  };

  const switchMode = (nextMode) => {
    setError('');
    setMode(nextMode);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (isRegister && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
        });
      } else {
        await login(formData.email, formData.password);
      }

      setFormData(EMPTY_FORM);
      setMode('login');
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-[61] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <div className="bg-dark-secondary border border-dark-border rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close authentication dialog"
                className="absolute top-4 right-4 text-light-gray hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 id="auth-modal-title" className="text-3xl font-bold text-white mb-2">
                {isRegister ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-light-gray mb-7">
                {isRegister
                  ? 'Join VAGE and discover your style.'
                  : 'Login to continue shopping.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isRegister && (
                  <div>
                    <label htmlFor="auth-full-name" className="block text-sm font-medium text-white mb-2">
                      Full Name
                    </label>
                    <input
                      id="auth-full-name"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={formData.fullName}
                      onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                      className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                      placeholder="Your full name"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={190}
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                {isRegister && (
                  <div>
                    <label htmlFor="auth-phone" className="block text-sm font-medium text-white mb-2">
                      Phone Number <span className="text-light-gray">(optional)</span>
                    </label>
                    <input
                      id="auth-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={formData.phone}
                      onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                      className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-password" className="block text-sm font-medium text-white mb-2">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    required
                    minLength={isRegister ? 8 : 1}
                    value={formData.password}
                    onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                    className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                    placeholder="••••••••"
                  />
                  {isRegister && (
                    <p className="text-xs text-light-gray mt-2">Use at least 8 characters.</p>
                  )}
                </div>

                {isRegister && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-white mb-2">
                      Confirm Password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={formData.confirmPassword}
                      onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                      className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                      placeholder="Re-enter your password"
                    />
                  </div>
                )}

                {error && (
                  <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? (isRegister ? 'Creating Account...' : 'Signing In...')
                    : (isRegister ? 'Create Account' : 'Login')}
                </button>
              </form>

              <p className="text-center text-light-gray text-sm mt-6">
                {isRegister ? 'Already have an account?' : 'New to VAGE?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? 'login' : 'register')}
                  disabled={isSubmitting}
                  className="text-white font-semibold underline underline-offset-4 hover:text-gray-300 disabled:opacity-50"
                >
                  {isRegister ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LoginModal;
