// See license.md
'use strict';

{ // Begin file block scope

function filter_html_attrs(doc, verbose) {
  // Using gebtn over selector because assumed faster and the collection is not
  // modified during iteration
  // Intentionally starting from the root element (doc element) of the doc
  // because this is intended to affect all elements, not just body
  const elements = doc.getElementsByTagName('*');
  for(const element of elements)
    filter_element_attrs(element, verbose);
}

function filter_element_attrs(element, verbose) {
  const local_name = element.localName;
  const attrs = element.attributes;

  if(!attrs || !attrs.length)
    return;

  // Sets of allowed attributes per tag name
  // Using plain object over Set/Map for speed
  // Using simple array for speed too (over Set)
  // allow 'rel' for anchor to allow for no-referrer
  // do not allow width/height for image because of inaccurate guesses earlier
  // leading to skewed images, leave unset so browser uses natural dimensions
  const type_attrs_map = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  const allowed_attrs = type_attrs_map[local_name];

  // Walk backwards because attributes is live and each removal during iteration
  // shortens the list.
  if(allowed_attrs) {
    // Remove attrs not in whitelist
    for(let i = attrs.length - 1; i > -1; i--) {
      const attr_name = attrs[i].name;
      if(!allowed_attrs.includes(attr_name))
        element.removeAttribute(attr_name);
    }
  } else {
    // Remove all attrs
    for(let i = attrs.length - 1; i > -1; i--)
      element.removeAttribute(attrs[i].name);
  }
}

this.filter_html_attrs = filter_html_attrs;

} // End file block scope
