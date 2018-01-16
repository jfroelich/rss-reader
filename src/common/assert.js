import formatString from "/src/common/format-string.js";

// Throws an error when the value is false-like. Should generally be used for things that
// should never happen, but it is Javascript, so basically use it as sugar for any error case.
export default function assert(value, ...varargs) {
  if(!value) {
    const message = formatString(...varargs) || 'Assertion failed';
    throw new Error(message);
  }
}
