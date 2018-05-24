// Filters blacklisted elements from document content.
// Not limited to body.
// The contains check helps reduce the number of dom modifications and actually
// speeds up the iteration.
// Use querySelectorAll over getElementsByTagName to simplify mutation during
// iteration.

// @param blacklist {Array} an array of names of elements, each name should be
// a string that corresponds to what would be used in a selector to match an
// element using querySelectorAll

export function filter_blacklisted_elements(document, blacklist) {
  // Tolerate a little bit of sloppiness
  if (!Array.isArray(blacklist)) {
    return;
  }

  if (!blacklist.length) {
    return;
  }

  const document_element = document.documentElement;
  const selector = blacklist.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}
