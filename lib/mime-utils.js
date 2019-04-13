// Provides helpers for interacting with purported mime-type values. A mime-type
// is a specialized type of string. Normal form characteristics are no
// intermediate whitespace and lowercase.

// These are approximations
export const MIN_LENGTH = 7;
export const MAX_LENGTH = 100;

// Returns whether the mime type value is superficially valid
export function isValid(value) {
  return typeof value === 'string' && value.length > MIN_LENGTH &&
      value.length < MAX_LENGTH && value.includes('/') && !value.includes(' ');
}

// Given a Content-Type HTTP header, returns the mime type as a string. Returns
// undefined when the input is bad (e.g. null/undefined) or when the input does
// not appear to contain a valid mime type.
export function parseContentType(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  // Strip the character encoding, if present
  const semicolonIndex = value.indexOf(';');
  if (semicolonIndex > -1) {
    value = value.substring(0, semicolonIndex);
  }

  // Normalize whitespace and case
  value = value.replace(/\s+/g, '').toLowerCase();

  return isValid(value) ? value : undefined;
}
