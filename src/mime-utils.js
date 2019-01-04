import * as string from '/src/string-utils.js';

export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Extract the mime type from an HTTP Content-Type header value
export function parse_content_type(value) {
  if (typeof value !== 'string') {
    return;
  }

  if (value.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  value = value.trim();
  if (value.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  let mime_type = strip_encoding(value);
  if (mime_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  mime_type = string.filter_whitespace(mime_type).toLowerCase();
  return is_mime_type(mime_type) ? mime_type : undefined;
}

export function strip_encoding(value) {
  const idx = value.indexOf(';');
  let mime_type = idx > -1 ? value.substring(0, idx) : value;
}

export function is_mime_type(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}
