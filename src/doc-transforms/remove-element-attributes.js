
function remove_element_attributes(doc, attribute_whitelist) {
  'use strict';
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    const attribute_names = element.getAttributeNames();
    if(attribute_names.length) {
      const allowed_names = attribute_whitelist[element.localName] || [];
      for(const name of attribute_names)
        if(!allowed_names.includes(name))
          element.removeAttribute(name);
    }
  }
}
