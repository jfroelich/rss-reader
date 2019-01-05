export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

export function is_valid(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}

export function parse_content_type(value) {
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
  if(typeof value === 'undefined') {
    return;
  }
  const idx = value.indexOf(';');
  return idx > -1 ? value.substring(0, idx) : value;
}

function filter_ws(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : undefined;
}
