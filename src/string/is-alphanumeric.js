
// TODO: this is only ever in use by one caller, maybe just move it there

// From the start of the string to its end, if one or more of the characters is not in the class of
// alphanumeric characters, then the string is not alphanumeric.
// See https://stackoverflow.com/questions/4434076
// See https://stackoverflow.com/questions/336210
// The empty string is true, null/undefined are true
// Does NOT support languages other than English
export default function isAlphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}
