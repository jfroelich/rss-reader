// Module for filtering element attributes from document content

import assert from "/src/assert.js";

// @param doc {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
export default function filterDocument(doc, whitelist) {
  assert(doc instanceof Document);
  assert(typeof whitelist === 'object');

  const keys = Object.keys(whitelist);
  if(keys.length === 0) {
    return;
  }

  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    const atributeNames = element.getAttributeNames();
    if(!atributeNames.length) {
      continue;
    }

    const allowedNames = whitelist[element.localName] || [];
    for(const name of atributeNames) {
      if(!allowedNames.includes(name)) {
        element.removeAttribute(name);
      }
    }
  }
}
