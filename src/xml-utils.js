// XML utilities module

import assert from "/src/utils/assert.js";
import * as mime from "/src/mime.js";

// Returns the unqualified name as lowercase. The lowercase call is important because of how case
// handling differs based on whether the document is internally flagged as xml or html. Because of
// the possible differences in behavior it is safer to incur the overhead of normalization, which is
// the function call to this, and the function call to toLowerCase, and the toLowerCase work.
export function getElementName(element) {
  return element.localName.toLowerCase();
}

export function xmlToBlob(doc) {
  assert(doc instanceof Document);
  const xmlString = xmlToString(doc);
  const parts = [xmlString];
  const options = {type: mime.MIME_TYPE_XML};
  return new Blob(parts, options);
}

function xmlToString(doc) {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
