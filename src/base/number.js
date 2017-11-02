'use strict';

// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
function numberIsPositiveInteger(number) {
  return Number.isInteger(number) && number >= 0;
}

// TODO: replace all parseInt callsites with this wrapper function
function numberParseInt10(number) {
  const RADIX = 10;
  return parseInt(number, RADIX);
}
