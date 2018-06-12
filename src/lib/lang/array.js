// Returns the value as the last index of the array or undefined when the
// array is empty
export function peek(array) {
  if (array.length) {
    return array[array.length - 1];
  }
}

export function is_empty(array) {
  return array.length === 0;
}
