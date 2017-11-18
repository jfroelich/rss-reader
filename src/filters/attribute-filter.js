// Module for filtering element attributes from document content

import assert from "/src/assert.js";

// @param doc {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
export default function filterDocument(doc, whitelist) {
  assert(doc instanceof Document);
  assert(typeof whitelist === 'object');

  // Exit early when no attributes are allowed
  const keys = Object.keys(whitelist);
  if(keys.length === 0) {
    return;
  }

  // Use getElementsByTagName because there is no concern about removing attributes while
  // iterating over the collection

  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    filterElementAttributes(element);
  }
}

function filterElementAttributes(element, whitelist) {

  // Use getAttributeNames over element.attributes because:
  // 1) Avoid complexity with changing attributes while iterating over element.attributes
  // 2) Simpler use of for..of
  // 3) Appears, for the moment, to be faster that iterating element.attributes
  // 4) It's newer and cooler.

  const atributeNames = element.getAttributeNames();
  if(!atributeNames.length) {
    return;
  }

  const allowedNames = whitelist[element.localName] || [];
  for(const name of atributeNames) {
    if(!allowedNames.includes(name)) {
      element.removeAttribute(name);
    }
  }
}
