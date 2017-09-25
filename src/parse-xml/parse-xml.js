// Parses a string containing XML into a Document object. Throws an exception
// when there on bad input.
function parse_xml(string) {
  'use strict';
  const parser = new DOMParser();
  const mime_type = 'application/xml';
  const doc = parser.parseFromString(string, mime_type);
  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    const error = new Error('Error parsing string into xml');
    throw error;
  }
  return doc;
}
