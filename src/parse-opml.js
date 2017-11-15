// OPML parsing

import {check, ParserError} from "/src/errors.js";
import parseXML from "/src/parse-xml.js";

// Returns the parsed document or throws an error
export default function parseOPML(xmlString) {
  const doc = parseXML(xmlString);
  // The lowercase call is important because of how case handling differs based on whether the
  // document is internally flagged as xml or html. Because of the possible differences in behavior
  // it is safer to incur the overhead of normalization.
  // TODO: the above comment would not be needed if there was a helper function that was adequately
  // named or documented such that it made the helper function call speak for itself. That is the
  // whole idea of abstraction, so that I don't have to carry around the anxiety, so that the
  // concern is addressed explicitly and settled.
  const name = doc.documentElement.localName.toLowerCase();
  check(name === 'opml', ParserError, 'document element ' + name + ' is not opml');
  return doc;
}
