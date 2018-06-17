// is_alphanumeric returns whether the value is an alphanumeric string. Counter
// intuitively, this works by testing for the presence of any non-alphanumeric
// character. The empty string is true, null/undefined are true.
//
// Notes:
// * Does not throw when the value is not a string. This is for caller
// convenience
// * Behavior when calling on strings containing non-English characters is
// undefined
//
// References:
// * https://stackoverflow.com/questions/4434076
// * https://stackoverflow.com/questions/336210
export function is_alphanumeric(value) {
  return /^[a-zA-Z0-9]*$/.test(value);
}
