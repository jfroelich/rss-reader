// This module exports a single function that accepts a value as input. If the input is a string
// then the function returns a new string that is approximately a copy of the input less certain
// 'unprintable' characters. The function is tolerant of bad types of input and will not throw
// in the case of null/undefined/etc. In the case of bad input the input itself is returned.

// The function does not expose an immediate way to test if it had any effect. To test, check if
// the output string length is less than the input string length.

// TODO: look into how much this overlaps with filterControls
// TODO: does + qualifer improve speed, decrease speed, or have no effect, or no material effect
// on performance?

// Basically this removes those characters in the range of [0..31] except for the following four
// characters:
// \t is \u0009 which is base10 9
// \n is \u000a which is base10 10
// \f is \u000c which is base10 12
// \r is \u000d which is base10 13

const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;

export default function main(value) {
  // The length check is done because given that replace will be a no-op when the length is 0 it is
  // faster to perform the length check than it is to call replace. I do not know the distribution
  // of inputs but I expect that empty strings are not rare.
  return typeof value === 'string' && value.length ? value.replace(pattern, '') : value;
}
