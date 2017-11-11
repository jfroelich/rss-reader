'use strict';

// import mime.js

// TODO: the class is stupid, this should be one function in the global namespace

class XMLParser {

  // @throws {AssertionError}
  // @throws {ParserError}
  static parse(xml) {
    assert(typeof xml === 'string');
    const parser = new DOMParser();

    const doc = parser.parseFromString(xml, mime.XML);
    assert(doc instanceof Document);

    // This cannot tell the difference between documents where the parser
    // introduced a new element and documents containing the element in the
    // input. In the interest of safety, this always fails.
    const parserErrorElement = doc.querySelector('parsererror');
    if(parserErrorElement) {
      let errorMessage = parserErrorElement.textContent;

      // Make the error output a bit prettier for the log
      errorMessage = errorMessage.replace(/\s+/g, ' ');

      throw new ParserError(errorMessage);
    }

    return doc;
  }
}
