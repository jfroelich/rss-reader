// TODO: i think this module is just too simple, and it unjustifiably couples
// together modules that are generally unrelated. i think it would probably be
// better to deprecate this. even the functions in this module are pretty
// bare-bones.

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
