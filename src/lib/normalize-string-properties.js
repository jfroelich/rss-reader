import assert from '/src/lib/assert.js';

// TODO: consider just a normalize-string method instead of a method that
// operates on all of the object's properties. for now implement the object
// helper then assess how the is used.

// TODO: consider fully deprecating. String.prototype.normalize's second
// argument is optional, and when not specified, defaults to NFC. By convention
// if all callers do not specify the argument then all callers use consistent
// behavior. This seems simpler by not requiring an extra module for something
// that is native.

// TODO: research which form is the most compact, or the most common. Perhaps
// the most common will involve the least processing? But that makes no sense
// since it still has to iterate. Separately, perhaps the most compact is
// desired, because this is primarily used for database storage. Does one of the
// forms tend to use fewer characters? Which form does the browser use
// everywhere by default? Would using a non-browser-default form require a ton
// of extra encoding/decoding and possibly also cause other confusion?

// atm, nfkc looks shorter. but the point is to understand why. probably need
// to read the spec.

// The form parameter must be one of the following, case-sensitive
// ripped from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
const forms = ['NFC', 'NFD', 'NFKC', 'NFKD'];

// Iterates over an object's string properties and normalizes each string value.
// The object is mutated in place for performance (clone before if you want
// to use an immutabile strategy). This library uses a specific normalization
// form so that by default all callers use the same target. However, you can
// override the target by specifying on the allowed forms.
//
// This module solves the following problems. (1) specifying a default form.
// while normalize has a default when form is not specified, i am not currently
// sure it is the same across platforms (although maybe that does not matter).
// (2) this library is a proxy against the functionality. if the functionality
// is not supported and needs shimming, or changes in some way, this shields the
// caller from the changes.
export default function normalize_string_properties(object, form = 'NFC') {
  // The input must be not null and proper type
  assert(object && typeof object === 'object');
  // The form must be one of the supported forms
  assert(forms.includes(form));

  // The platform must support the normalize method. Noop in unsupported case
  // to allow running without an error.
  if (!String.prototype.normalize) {
    return;
  }


  for (const key in object) {
    if (typeof key === 'string') {
      const value = object[key];
      const normalized_value = value.normalize(form);

      // TEMP: monitoring new functionality
      if (value !== normalized_value) {
        if (value.length < 100 && normalized_value.length < 100) {
          console.debug(
              'Normalized string', value, value.length, normalized_value,
              normalized_value.length);
        } else {
          console.debug('Normalized string (message too large to display)');
        }
      }

      object[key] = normalized_value;
    }
  }
}
