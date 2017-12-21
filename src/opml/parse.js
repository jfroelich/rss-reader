import parseXML, {XMLParseError} from "/src/utils/parse-xml.js";
import sprintf from "/src/utils/sprintf.js";

// Returns the parsed document or throws an XMLParseError or an unchecked error or an
// OPMLParseError
export default function parseOPML(xmlString) {
  const doc = parseXML(xmlString);
  // NOTE: lowercase because xml documents are case-sensitive
  const name = doc.documentElement.localName.toLowerCase();
  if(name !== 'opml') {
    const message = sprintf('Document element "%s" is not opml', name);
    throw new OPMLParseError(message);
  }
  return doc;
}

export class OPMLParseError extends XMLParseError {
  constructor(message) {
    super(message || 'OPML parse error');
  }
}
