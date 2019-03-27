// Return whether a value is iterable
export default function is_iterable(value) {
  // See https://stackoverflow.com/questions/18884249
  return value !== null && Symbol.iterator in Object(value);
}
