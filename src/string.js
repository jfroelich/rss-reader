export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export function filter_controls(value) {
  return value.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

export function filter_whitespace(value) {
  return value.replace(/\s+/g, '');
}

export function is_alphanumeric(value) {
  return !/[^\p{L}\d]/u.test(value);
}
