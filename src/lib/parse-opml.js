import {parse_xml} from '/src/lib/parse-xml.js';

// Parses a string containing opml into a Document object.
export function parse_opml(xml_string) {
  const document = parse_xml(xml_string);
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}
