'use strict';

// import base/assert.js
// import base/status.js

// @param doc {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
function attribute_filter(doc, whitelist) {
  ASSERT(doc instanceof Document);
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    const attribute_names = element.getAttributeNames();
    if(!attribute_names.length) {
      continue;
    }

    const allowed_names = whitelist[element.localName] || [];
    for(const name of attribute_names) {
      if(!allowed_names.includes(name)) {
        element.removeAttribute(name);
      }
    }
  }

  return STATUS_OK;
}
