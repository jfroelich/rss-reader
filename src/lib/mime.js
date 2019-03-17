// Provides helpers for interacting with purported mime-type values. A mime-type
// is a specialized type of string. Normal form characteristics are no
// intermediate whitespace and lowercase.

// These are approximations
export const MIN_LENGTH = 7;
export const MAX_LENGTH = 100;

// Returns whether the mime type value is superficially valid
export function is_valid(value) {
  return typeof value === 'string' && value.length > MIN_LENGTH &&
      value.length < MAX_LENGTH && value.includes('/') && !value.includes(' ');
}

// Given a Content-Type HTTP header, returns the mime type as a string. Returns
// undefined when the input is bad (e.g. null/undefined) or when the input does
// not appear to contain a valid mime type.
export function parse_content_type(value) {
  if (typeof value !== 'string') {
    return;
  }

  // Strip the character encoding, if present
  const semicolon_index = value.indexOf(';');
  if (semicolon_index > -1) {
    value = value.substring(0, semicolon_index);
  }

  // Normalize whitespace and case
  value = value.replace(/\s+/g, '').toLowerCase();

  return is_valid(value) ? value : undefined;
}
