import assert from '/src/lib/assert.js';

// Returns whether the given value represents a valid object identifier in the
// datbase
export function is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Mutate the input resource object such that its properties are normalized. For
// example, strings with different unicode encodings become canonical.
export function normalize_resource(resource) {
  // assume urls are normalized elsewhere
  // We do not specify the argument to String.prototype.normalize so that it
  // defaults to NFC. This is the appropriate normal form for strings. See #770
  // or https://unicode.org/reports/tr15/.
  if (resource.author) {
    resource.author = resource.author.normalize();
  }

  if (resource.title) {
    resource.title = resource.title.normalize();
  }

  if (resource.content) {
    resource.content = resource.content.normalize();
  }

  if (resource.description) {
    resource.description = resource.description.normalize();
  }
}
