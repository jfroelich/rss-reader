import * as xml_parser from '/src/lib/xml-parser/xml-parser.js';

export function parse(xml_string) {
  const document = xml_parser.parse(xml_string);
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}
