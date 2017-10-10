// Removes non-whitelisted attributes from all elements in a document
// @param doc {Document}
// @param attribute_whitelist {Object} a basic object where each property is
// the name of a permitted element
// TODO: write tests
function remove_element_attributes(doc, attribute_whitelist) {
  'use strict';

  // Using getElementsByTagName as opposed to querySelectorAll for speed given
  // no elemental removal during iteration
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    // getAttributeNames was introduced mid 2017, it seems to be faster than
    // walking the attributes collection, and it avoids any issues with
    // mutation during iteration
    const attribute_names = element.getAttributeNames();
    if(attribute_names.length) {
      const allowed_names = attribute_whitelist[element.localName] || [];
      for(const name of attribute_names)
        if(!allowed_names.includes(name))
          element.removeAttribute(name);
    }
  }
}
