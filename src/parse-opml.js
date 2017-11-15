// OPML parsing

import {check} from "/src/errors.js";
import parseXML from "/src/parse-xml.js";

// @param xml {String}
// @returns {Document} document
export default function parseOPML(xml) {
  const doc = parseXML(xml);
  const name = doc.documentElement.localName.toLowerCase();

  // TODO: use a more specific error
  // TODO: use better wording
  // TODO: do not use unnamed parameter
  check(name === 'opml', undefined, 'document element is not "opml", it is ' + name);

  return doc;
}
