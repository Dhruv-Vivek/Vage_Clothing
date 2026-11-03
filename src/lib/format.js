// Plain helpers shared by server and client components.
export function inr(value, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}
