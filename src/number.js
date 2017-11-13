// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
export function isPosInt(number) {
  return Number.isInteger(number) && number >= 0;
}

const BASE_10_RADIX = 10;

// Wraps parseInt with a base 10 parameter. This is both convenient and avoids
// surprising parse results (such as when parsing '010').

export function parseInt10(number) {
  return parseInt(number, BASE_10_RADIX);
}
