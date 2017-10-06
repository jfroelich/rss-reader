// Parses a string containing XML into a Document object. Throws an exception
// when there on bad input.
function xml_parse_from_string(string) {
  'use strict';
  const parser = new DOMParser();
  const mime_type = 'application/xml';
  const doc = parser.parseFromString(string, mime_type);

  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    DEBUG(error_element.textContent);
    return;
  }

  return doc;
}
