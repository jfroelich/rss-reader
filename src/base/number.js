'use strict';

// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
function number_is_positive_integer(number) {
  return Number.isInteger(number) && number >= 0;
}
