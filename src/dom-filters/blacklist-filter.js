import assert from '/src/assert.js';

// Filters blacklisted elements from document content.
// @param blacklist {Array} an array of names of elements, each name should be
// a string that corresponds to what would be used in a selector to match an
// element using querySelectorAll
export function blacklist_filter(document, blacklist) {
  // Exit early when there is no work to do. Tolerate bad param (Postel).
  if(!Array.isArray(blacklist) || blacklist.length < 1) {
    return;
  }

  // Find all occurrences of all element names in the list and remove them
  const document_element = document.documentElement;
  const selector = blacklist.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}
