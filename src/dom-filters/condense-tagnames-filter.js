import {coerce_element} from '/src/dom-utils/coerce-element.js';

// Replaces certain elements with near equivalents that use fewer characters in
// the element name, so that when a document it serialized, it contains fewer
// characters.
// @param document {Document} the document to modify
// @param copy_attrs_flag {Boolean} whether to copy html attributes when
// replacing an element
export function condense_tagnames_filter(document, copy_attrs_flag) {
  // Analysis is restricted to body.
  if (!document.body) {
    return;
  }

  // For performance, I found it was faster to do repeated CSS queries with
  // multiple passes over the content rather than walking the document using a
  // node iterator or tree walker.

  rename_elements(document.body, 'strong', 'b', copy_attrs_flag);
  rename_elements(document.body, 'em', 'i', copy_attrs_flag);
}

// Renames all occurrences of the element with the given name
function rename_elements(ancestor, name, new_name, copy_attrs_flag) {
  const elements = ancestor.querySelectorAll(name);
  for (const element of elements) {
    coerce_element(element, new_name, copy_attrs_flag);
  }
}
