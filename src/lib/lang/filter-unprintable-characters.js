// If the input is a string then this returns a new string that is a copy of the
// input less certain 'unprintable' characters. A character is unprintable if
// its character code falls within the range of [0..31] except for tab, new
// line, carriage return and form feed. In the case of bad input the input
// itself is returned. To test if characters were replaced, check if the output
// string length is less than the input string length.
// TODO: look into how much this overlaps with filter_control_characters
// TODO: review why I decided to allow form-feed? I'm not sure why.

export function filter_unprintable_characters(value) {
  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
  // The regex matches 0-8, 11, and 14-31
  // I assume v8 will hoist regex if this is hot, so I am defining the constant
  // within the function
  // I assume v8 handles + and /g redundancy intelligently

  // The length check is done because given that replace will be a no-op when
  // the length is 0 it is faster to perform the length check than it is to call
  // replace. I do not know the distribution of inputs but I expect that empty
  // strings are not rare.

  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}
