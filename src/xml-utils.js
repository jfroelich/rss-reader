// XML utilities module

import assert from "/src/assert.js";
import * as mime from "/src/mime.js";

export function xmlToBlob(doc) {
  assert(doc instanceof Document);
  const xmlString = xmlToString(doc);
  const parts = [xmlString];
  const options = {type: mime.XML};
  return new Blob(parts, options);
}

function xmlToString(doc) {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
