export function filter_unprintables(value) {
  if (typeof value !== 'string') {
    return value;
  }

  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
  // The regex matches 0-8, 11, and 14-31, all inclusive
  return value.replace(/[\u0000-\u0008\u000b\u000e-\u001F]+/g, '');
}
