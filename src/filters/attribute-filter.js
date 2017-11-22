import assert from "/src/assert.js";

// @param doc {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
export default function filterDocument(doc, whitelist) {
  assert(doc instanceof Document);
  assert(typeof whitelist === 'object');

  // Use getElementsByTagName because there is no concern about removing attributes while
  // iterating over the collection

  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    filterElementAttributes(element, whitelist);
  }
}

function filterElementAttributes(element, whitelist) {

  // Use getAttributeNames over element.attributes because:
  // 1) Avoid complexity with changing attributes while iterating over element.attributes
  // 2) Simpler use of for..of
  // 3) Appears, for the moment, to be faster than iterating element.attributes

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
