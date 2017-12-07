// This module exports a single function that accepts a value as input. If the input is a string
// then the function returns a new string that is approximately a copy of the input less certain
// 'unprintable' characters. The function is tolerate of bad types of input and will not throw
// in the case of null/undefined/etc. In the case of bad input the input itself is returned.

// The function does not expose an immediate way to test if it had any effect. To test, check if
// the output string length is less than the input string length.

// TODO: look into how much this overlaps with filterControls
// TODO: would + qualifer improve speed, decrease speed, or have no effect, or no material effect
// on performance?

// \t is \u0009 which is base10 9
// \n is \u000a which is base10 10
// \f is \u000c which is base10 12
// \r is \u000d which is base10 13

const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]/g;

export default function main(value) {
  return typeof value === 'string' && value.length ? value.replace(pattern, '') : value;
}
