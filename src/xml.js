// Library for working with xml

// Dependencies
// assert.js
// debug.js
// mime.js
// status.js

// Parses an xml string into a document
function xml_parse_from_string(xml_string) {
  'use strict';
  const parser = new DOMParser();

  // parseFromString always yields a defined document, regardless of the
  // validity of the input value (e.g. null, wrong type)
  const doc = parser.parseFromString(xml_string, MIME_TYPE_XML);

  // This cannot tell the difference between documents where the parser
  // introduced a new element and documents containing the element in the
  // input. In the interest of safety, this always fails.
  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    DEBUG(error_element.textContent);
    return [ERR_PARSE];
  }

  return [STATUS_OK, doc];
}

// Serializes an xml document into a string
// @param doc {Document}
// @returns {String}
function xml_to_string(doc) {
  'use strict';
  ASSERT(doc);
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(doc);
  return xml_string;
}

// Converts an xml document into a blob
// @param doc {Document}
// @returns {Blob}
function xml_to_blob(doc) {
  'use strict';
  ASSERT(doc);
  const mime_type = 'application/xml';
  const xml_string = xml_to_string(doc);
  const options = {'type': mime_type};

  // TODO: is the [] required?
  return new Blob([xml_string], options);
}
