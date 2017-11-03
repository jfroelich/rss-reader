'use strict';

// import base/assert.js
// import base/errors.js

// @param doc {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
function attributeFilter(doc, whitelist) {
  assert(doc instanceof Document);

  // TODO: assert whitelist
  // TODO: exit early if whitelist empty

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

  return RDR_OK;
}
