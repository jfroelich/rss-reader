// Return a new array consisting of only distinct values (compared by
// equality). Relative order is maintained. Throws an error if the input is not
// an array. The internal lambda only returns true when the index of the current
// value during traveral is equal to the earliest index of the the value in the
// input array. Obviously not the most efficient but pretty simple. Adapted from
// https://stackoverflow.com/questions/11246758
export function unique(array) {
  return array.filter((value, index) => array.indexOf(value) === index);
}

// Similar to unique, but with an optional compute function that derives a
// value to use for comparison to other values. When |compute| is not specified
// it defaults to the same behavior as unique.
export function unique_compute(array, compute) {
  if (typeof compute !== 'function') {
    return unique(array);
  }

  const seen_computed = [];
  return array.filter(value => {
    const computed_value = compute(value);
    if (seen_computed.includes(computed_value)) {
      return false;
    } else {
      seen_computed.push(computed_value);
      return true;
    }
  });
}
