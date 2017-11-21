// OPML parsing

import {check, ParseError} from "/src/utils/errors.js";
import parseXML from "/src/xml/parse.js";
import {getElementName} from "/src/xml/utils.js";

// Returns the parsed document or throws an error
export default function parseOPML(xmlString) {
  const doc = parseXML(xmlString);
  const name = getElementName(doc.documentElement);
  check(name === 'opml', ParseError, 'document element "%s" is not opml', name);
  return doc;
}
