import * as string from '/src/lang-utils/string.js';


export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Tries to get the mime type corresponding to an HTTP Content-Type header
// value. Returns undefined on any failure.
export function parse_content_type(value) {
  // For convenience, allow the caller to call this without checking the header
  // value
  if (typeof value !== 'string') {
    return;
  }

  // Try and avoid the cost of trim
  // TODO: profile whether this is worth it, may be premature optimization
  if (value.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  value = value.trim();

  // Try and avoid the cost of search
  // TODO: profile whether this is worth it, may be premature optimization
  if (value.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Chop of the trailing encoding, if it exists
  const scpos = value.indexOf(';');
  let mime_type = scpos > -1 ? value.substring(0, scpos) : value;

  // Try and avoid the cost of normalization
  // TODO: profile, may be premature optimization
  if (mime_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Normalize the value
  mime_type = string.filter_whitespace(mime_type).toLowerCase();

  // Provide minimal guarantee the output is valid
  if (!is_mime_type(mime_type)) {
    return;
  }

  return mime_type;
}

// Returns whether a string loosely approximates a mime type
export function is_mime_type(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}
