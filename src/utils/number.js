

// TODO: this file basically only exports a single function. Rename the file to is-pos-int.js, and
// export the one function as the default.

// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
export function isPosInt(number) {
  return Number.isInteger(number) && number >= 0;
}
