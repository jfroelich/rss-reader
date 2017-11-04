'use strict';

// import base/errors.js
// import net/mime.js

class XMLParser {

  // @throws {AssertionError}
  // @throws {ParserError}
  static parse(xml) {
    assert(typeof xml === 'string');
    const parser = new DOMParser();

    // Does not throw
    const doc = parser.parseFromString(xml, mime.XML);
    assert(doc instanceof Document);

    // This cannot tell the difference between documents where the parser
    // introduced a new element and documents containing the element in the
    // input. In the interest of safety, this always fails.
    const parserErrorElement = doc.querySelector('parsererror');
    if(parserErrorElement) {
      throw new ParserError(parserErrorElement.textContent);
    }

    return doc;
  }
}
