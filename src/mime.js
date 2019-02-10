// Provides helpers for interacting with purported mime-type values. A mime-type
// is a specialized type of string.

// TODO: remove all the tolerance for undefined in the internal helpers, enforce
// a policy of always-defined input and implicitly throw otherwise


// These are not exact, just rough approximations that weed out likely false
// positives in the validity check
export const MIN_LENGTH = 7;
export const MAX_LENGTH = 100;

// Returns whether the value looks like a valid mime type. This is a minimal
// check intended to minimize obviously bad values while possibly allowing
// through (misclassifying) a few.
export function is_valid(value) {
  return typeof value === 'string' && value.length > MIN_LENGTH &&
      value.length < MAX_LENGTH && value.includes('/') && !value.includes(' ');
}

export function parse_content_type(value) {
  // TODO: increase strictness?
  if (typeof value !== 'string') {
    return;
  }

  const type = normalize(strip_encoding(value));
  return is_valid(type) ? type : undefined;
}

function normalize(type) {
  return typeof type === 'string' ? filter_ws(type).toLowerCase() : undefined;
}

function strip_encoding(value) {
  if (typeof value === 'undefined') {
    return;
  }
  const idx = value.indexOf(';');
  return idx > -1 ? value.substring(0, idx) : value;
}

function filter_ws(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : undefined;
}
