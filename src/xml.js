'use strict';

// import base/errors.js
// import net/mime.js

function xml_parse_from_string(xml_string) {
  console.assert(xml_string);

  const parser = new DOMParser();

  // parseFromString always yields a defined document, regardless of the
  // validity of the input value (e.g. null, wrong type). There is no need
  // for assertions.
  const doc = parser.parseFromString(xml_string, MIME_TYPE_XML);

  // This cannot tell the difference between documents where the parser
  // introduced a new element and documents containing the element in the
  // input. In the interest of safety, this always fails.
  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    console.log(error_element.textContent);
    return [RDR_ERR_PARSE];
  }

  return [RDR_OK, doc];
}

// @param doc {Document}
// @returns {String}
function xml_to_string(doc) {
  console.assert(doc instanceof Document);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

// @param doc {Document}
// @returns {Blob}
function xml_to_blob(doc) {
  console.assert(doc instanceof Document);
  const xml_string = xml_to_string(doc);
  const parts_array = [xml_string];
  const options = {'type': MIME_TYPE_XML};
  return new Blob(parts_array, options);
}
