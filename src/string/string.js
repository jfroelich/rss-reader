
export function condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// TODO: look into how much this overlaps with filter_control_characters
// TODO: review why I decided to allow form-feed? I'm not sure why.
// If the input is a string then this returns a new string that is a copy of the
// input less certain 'unprintable' characters. A character is unprintable if
// its character code falls within the range of [0..31] except for tab, new
// line, carriage return and form feed. In the case of bad input the input
// itself is returned. To test if characters were replaced, check if the output
// string length is less than the input string length.
export function filter_unprintable_characters(value) {
  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13

  // Match 0-8, 11, and 14-31
  // NOTE: I assume v8 will hoist if this is hot
  // NOTE: I assume v8 handles + and /g redundancy intelligently
  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;

  // The length check is done because given that replace will be a no-op when
  // the length is 0 it is faster to perform the length check than it is to call
  // replace. I do not know the distribution of inputs but I expect that empty
  // strings are not rare.
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string. Adapted from these stack
// overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function filter_control_characters(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
