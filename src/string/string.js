export function condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

export function filter_unprintable_characters(value) {
  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}

function filter_control_characters(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
