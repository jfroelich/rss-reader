
import {XMLParser} from "/src/xml-parser.js";

// TODO: the class is dumb now with modules, just export a function

export class OPMLParser {

  // @param xml {String}
  // @throws {AssertionError}
  // @throws {ParserError}
  // @throws {Error} invalid document element
  // @returns {Document} document
  static parse(xml) {
    // Allow errors to bubble
    const doc = XMLParser.parse(xml);
    const name = doc.documentElement.localName.toLowerCase();
    if(name !== 'opml') {
      // TODO: use a more specific error
      throw new Error('documentElement not opml: ' + name);
    }

    return doc;
  }
}
