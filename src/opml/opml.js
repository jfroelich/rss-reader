// Dependencies:
// xml_parse_from_string
// OPMLDocument

// Parses the input string and returns a new OPMLDocument object
function opml_parse(input_string) {
  'use strict';
  const doc = xml_parse_from_string(input_string);
  if(!doc) {
    DEBUG(new Error('xml parsing error'));
    return;
  }

  const name = doc.documentElement.localName.toLowerCase();
  if(name !== 'opml') {
    DEBUG('root element name is not opml:', name);
    return;
  }

  return new OPMLDocument(doc);
}
