// Returns the value as the last index of the array or undefined when the
// array is empty
export function peek(array) {
  if (array.length) {
    return array[array.length - 1];
  }
}

// Return true if the array is empty
// Return true if the array is undefined/null
export function is_empty(array) {
  return array === null || array === undefined || array.length === 0;
}
