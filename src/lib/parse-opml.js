// Parses a string containing opml into a Document object. Throws an error if
// the parameter is unexpected or if there is a parse error.
export function parse_opml(xml_string) {
  const document = parse_xml(xml_string);
  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}

// Parses an xml string into a xml-flagged Document object.
function parse_xml(xml_string) {
  if (typeof xml_string !== 'string') {
    throw new TypeError('xml_string is not a String');
  }

  const xml_mime_type = 'application/xml';
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, xml_mime_type);
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(condense_whitespace(error.textContent));
  }
  return document;
}

function condense_whitespace(value) {
  return value.replace(/\s{2,}/g, ' ');
}
