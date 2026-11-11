/**
 * Backend validation rules for account/address payloads.
 * See backend/README.md for the database/backend walkthrough.
 */
export function validateAddressPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'A valid address is required.' };
  }
  const label = typeof body.label === 'string' ? body.label.trim() : 'Home';
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const phoneDigits = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
  const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() : '';
  const addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const stateName = typeof body.stateName === 'string' ? body.stateName.trim() : '';
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
  const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : 'India';

  if (!label || label.length > 40) return { error: 'Address label must contain 1 to 40 characters.' };
  if (recipientName.length < 2 || recipientName.length > 120) return { error: 'Enter a valid recipient name.' };
  if (phoneDigits.length < 10 || phoneDigits.length > 15) return { error: 'Enter a valid phone number with 10 to 15 digits.' };
  if (!addressLine1 || addressLine1.length > 200) return { error: 'Address line 1 must contain 1 to 200 characters.' };
  if (addressLine2.length > 200) return { error: 'Address line 2 must be 200 characters or fewer.' };
  if (!city || city.length > 100) return { error: 'Enter a valid city.' };
  if (!stateName || stateName.length > 100) return { error: 'Enter a valid state or region.' };
  if (!postalCode || postalCode.length > 20) return { error: 'Enter a valid postal code.' };
  if (country.length < 2 || country.length > 80) return { error: 'Country must contain 2 to 80 characters.' };
  if (country.toLowerCase() === 'india' && !/^[0-9]{6}$/.test(postalCode)) {
    return { error: 'Indian PIN codes must contain exactly 6 digits.' };
  }

  return {
    value: {
      label,
      recipientName,
      phone: phoneDigits,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      stateName,
      postalCode,
      country,
      isDefault: body.isDefault === true,
    },
  };
}
