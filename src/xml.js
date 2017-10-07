// Parses a string containing XML into a Document object. Throws an exception
// when there on bad input.
function xml_parse_from_string(string) {
  'use strict';
  const parser = new DOMParser();
  const mime_type = 'application/xml';

  // TODO: test whether doc is guaranteed defined regardless of input
  const doc = parser.parseFromString(string, mime_type);

  // TODO: think of a way to differentiate between a parser introduced
  // parsererror element and an input document containing a parsererror element.
  // One is an error and one is not.
  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    // As tempting as it is to show the parsererror text, this is untrusted
    // user input. It is safe to send to DEBUG but not to the browser.
    DEBUG(error_element.textContent);
    return;
  }

  return doc;
}

// Serializes an xml document into a string
function xml_to_string(doc) {
  'use strict';
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(doc);
  return xml_string;
}

// Returns a new blob of the xml document
// @param doc {Document}
// @returns {Blob}
function xml_to_blob(doc) {
  'use strict';
  const mime_type = 'application/xml';
  const xml_string = xml_to_string(doc);
  const blob_constructor_options = {'type': mime_type};
  return new Blob([xml_string], blob_constructor_options);
}
