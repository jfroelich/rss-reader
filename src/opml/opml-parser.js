// Dependencies:
// parse_xml
// OPMLDocument

// Parses the input string and returns a new OPMLDocument object
function parse_opml(string) {
  'use strict';
  // Allow exceptions to bubble
  const doc = parse_xml(string);
  const name = doc.documentElement.localName.toLowerCase();

  // NOTE: intentionally not reporting the name that was used to avoid any
  // security issues
  if(name !== 'opml')
    throw new Error('Document element is not opml');
  return new OPMLDocument(doc);
}
