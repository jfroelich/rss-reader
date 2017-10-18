// element attribute filtering lib

'use strict';

// Dependencies:
// assert.js

// TODO: there are other types of attribute filters. To distinguish, rename
// this to something like attribute-whitelist-filter

// TODO: add a separate filter that removes units from certain attributes,
// like 100px => 100, as a condense step

// TODO: add a separate filter that trims attribute values that are retained

// TODO: add a separate filter that removes attributes that do not have values
// when they should have values. E.g. for all anchors, if an anchor has
// an href attribute but the value is null/undefined/empty string or even
// trimmed then empty string, then the href attribute should not exist

// TODO: add a separate filter that removes attributes that have explicit
// values that are equal to default values. E.g. align="left" is the default


// Removes non-whitelisted attributes from all elements in a document
// @param doc {Document}
// @param whitelist {Object} a basic object where each property is
// the unqualified name of an element, and each property value is an array of
// one or more allowed attribute names
function attribute_filter(doc, whitelist) {
  ASSERT(doc);

  // Using getElementsByTagName as opposed to querySelectorAll for speed given
  // no elemental removal during iteration
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    attribute_filter_element(element, whitelist);
  }
}

function attribute_filter_element(element, whitelist) {
  // getAttributeNames was introduced mid 2017, it seems to be faster than
  // walking the attributes collection, and it avoids any issues with
  // mutation during iteration
  const attribute_names = element.getAttributeNames();

  // Given the lookup cost, try and exit early
  if(!attribute_names.length) {
    return;
  }

  // Lookup the list of allowed attributes based on the element's type
  const allowed_names = whitelist[element.localName];

  // Strip everything if no whitelist. This loop is redundant with the later
  // loop but it avoids doing a lookup per iteration. This case is so common,
  // because the vast majority of elements do not have a whitelist, that
  // it is worth the duplication.
  if(!allowed_names || !allowed_names.length) {
    for(const name of attribute_names) {
      element.removeAttribute(name);
    }
    return;
  }

  // Remove all attributes not in the set of allowed names
  for(const name of attribute_names) {
    if(!allowed_names.includes(name))
      element.removeAttribute(name);
  }
}
