import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';

// Normalize the property values of the entry. Currently this only touches
// string values, but it may normalize other values in the future. Throws an
// error if the input is not a database entry object, or if properties are of
// the wrong type.
export default function normalize_entry(entry) {
  assert(is_entry(entry));

  // We do not specify the argument to String.prototype.normalize so that it
  // defaults to NFC. This is the appropriate normal form for strings. See #770
  // or https://unicode.org/reports/tr15/.

  // We characterize properties as system properties or user properties. We only
  // normalize user properties that may contain untrusted data from an external
  // byte source.

  // normalize is a generic method that is attached to String. Here we assume
  // that if these property values are truthy, they are strings. We assume that
  // String.prototype.normalize is supported. We do not assume these properties
  // are present in the entry.

  if (entry.author) {
    entry.author = entry.author.normalize();
  }

  if (entry.title) {
    entry.title = entry.title.normalize();
  }

  if (entry.content) {
    entry.content = entry.content.normalize();
  }
}
