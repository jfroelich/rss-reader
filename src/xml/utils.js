import assert from "/src/assert/assert.js";

// Returns the unqualified name as lowercase. The lowercase call is important because of how case
// handling differs based on whether the document is internally flagged as xml or html. Because of
// the possible differences in behavior it is safer to incur the overhead of normalization, which is
// the function call to this, and the function call to toLowerCase, and the toLowerCase work.
export function getElementName(element) {
  return element.localName.toLowerCase();
}
