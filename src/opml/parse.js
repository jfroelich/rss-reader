import {ParseError} from "/src/operations/parse-operation.js";
import check from "/src/utils/check.js";
import parseXML from "/src/xml/parse.js";

// Returns the parsed document or throws an error
export default function parseOPML(xmlString) {
  const doc = parseXML(xmlString);
  // NOTE: lowercase because xml documents are case-sensitive
  const name = doc.documentElement.localName.toLowerCase();
  check(name === 'opml', ParseError, 'Document element "%s" is not opml', name);
  return doc;
}
