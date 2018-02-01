// Removes certain attributes from all elements in a document
// @param document {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
export default function applyAttributeWhitelistFilter(document, whitelist) {
  if (!(document instanceof Document)) {
    throw new TypeError('Invalid document argument ' + document);
  }

  if (whitelist === null || typeof whitelist !== 'object') {
    throw new TypeError('Invalid whitelist argument ' + whitelist);
  }

  // Use getElementsByTagName because there is no concern about removing
  // attributes while iterating over the collection and because it is supposedly
  // faster than querySelectorAll
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    filterElementAttributes(element, whitelist);
  }
}

function filterElementAttributes(element, whitelist) {
  // Use getAttributeNames over element.attributes because:
  // 1) Avoid complexity with changing attributes while iterating over
  // element.attributes
  // 2) Simpler use of for..of
  // 3) For the moment, appears to be faster than iterating element.attributes

  const attributeNames = element.getAttributeNames();
  if (attributeNames.length) {
    const whitelistedNames = whitelist[element.localName] || [];
    for (const attributeName of attributeNames) {
      if (!whitelistedNames.includes(attributeName)) {
        element.removeAttribute(attributeName);
      }
    }
  }
}
