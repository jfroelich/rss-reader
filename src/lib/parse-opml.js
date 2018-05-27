import * as xml_parser from '/src/lib/xml-parser.js';

// Provides opml parsing functionality. `parse` parses a string containing opml
// into a Document object.

export function parse_opml(xml_string) {
  const document = xml_parser.parse(xml_string);
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}
