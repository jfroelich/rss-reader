'use strict';

// TODO: test result on NaN, Number.POSITIVE_INFINITY
function number_is_positive_integer(number) {
  return Number.isInteger(number) && number >= 0;
}
