// OPML parsing

import {check, ParserError} from "/src/errors.js";
import parseXML from "/src/parse-xml.js";
import {getElementName} from "/src/xml-utils.js";

// Returns the parsed document or throws an error
export default function parseOPML(xmlString) {
  const doc = parseXML(xmlString);
  const name = getElementName(doc.documentElement);
  check(name === 'opml', ParserError, 'document element "' + name + '" is not opml');
  return doc;
}
