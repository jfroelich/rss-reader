// Returns a new string where Unicode Cc-class characters have been removed.
//
// Throws an error if string is not a defined string.
//
// Adapted from these stack overflow questions:
//
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filter_control_characters(value) {
  return value.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
