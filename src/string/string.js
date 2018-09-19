export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export function filter_unprintables(value) {
  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
  // The regex matches 0-8, 11, and 14-31, all inclusive
  return value.replace(/[\u0000-\u0008\u000b\u000e-\u001F]+/g, '');
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
