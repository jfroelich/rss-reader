import assert from '/src/assert/assert.js';

// Filters blacklisted elements from document content.
// @param blacklist {Array} an array of names of elements, each name should be
// a string that corresponds to what would be used in a selector to match an
// element using querySelectorAll
export function filter_blacklisted_elements(document, blacklist) {
  assert(Array.isArray(blacklist));
  // Given that it is pointless to ever run this function on an empty blacklist,
  // this is equivalent to a programmer error. This function should never be
  // called on an empty list.
  assert(blacklist.length);

  const document_element = document.documentElement;
  const selector = blacklist.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}
