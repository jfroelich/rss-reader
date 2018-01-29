import formatString from "/src/common/format-string.js";

// Throws an error when the value is false-like. Should generally be used for
// things that should never happen, but it is Javascript, so basically use it
// as sugar for any error case.
// @param value {Any} any type of value, the assertion is triggered if the
// value is "falsy", such as if the value is undefined, null, 0, empty string,
// or false.
// @param varargs {...} any number of other arguments that are forwarded to
// format string, the first one usually being the formatting string
export default function assert(value, ...varargs) {
  if(!value) {
    const message = formatString(...varargs) || 'Assertion failed';
    throw new Error(message);
  }
}
