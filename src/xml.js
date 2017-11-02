'use strict';

// import base/errors.js
// import net/mime.js

// TODO: split into XMLParser and XMLDocumentUtils

function xmlParseFromString(xml) {
  console.assert(xml);

  const parser = new DOMParser();

  // parseFromString always yields a defined document, regardless of the
  // validity of the input value (e.g. null, wrong type). There is no need
  // for assertions.
  const doc = parser.parseFromString(xml, MIME_TYPE_XML);

  // This cannot tell the difference between documents where the parser
  // introduced a new element and documents containing the element in the
  // input. In the interest of safety, this always fails.
  const parserErrorElement = doc.querySelector('parsererror');
  if(parserErrorElement) {
    console.log(parserErrorElement.textContent);
    return [RDR_ERR_PARSE];
  }

  return [RDR_OK, doc];
}

// @param doc {Document}
// @returns {String}
function xmlToString(doc) {
  console.assert(doc instanceof Document);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

// @param doc {Document}
// @returns {Blob}
function xmlToBlob(doc) {
  console.assert(doc instanceof Document);
  const xml = xmlToString(doc);
  const partsArray = [xml];
  const options = {'type': MIME_TYPE_XML};
  return new Blob(partsArray, options);
}
