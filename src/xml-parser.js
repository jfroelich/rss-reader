'use strict';

// import base/errors.js
// import net/mime-utils.js

class XMLParser {
  static parse(xml) {

    // Even though parseFromString tolerates bad input, this function expects
    // the proper type, and not receiving it indicates a programming error.
    if(typeof xml !== 'string') {
      return [RDR_EINVAL];
    }

    const parser = new DOMParser();

    // NOTE: parseFromString generates a default document with an embedded
    // error for invalid input; does not throw
    const doc = parser.parseFromString(xml, MIMEUtils.XML);
    assert(doc instanceof Document);

    // This cannot tell the difference between documents where the parser
    // introduced a new element and documents containing the element in the
    // input. In the interest of safety, this always fails.
    const parserErrorElement = doc.querySelector('parsererror');
    if(parserErrorElement) {
      console.warn(parserErrorElement.textContent);
      return [RDR_ERR_PARSE];
    }

    return [RDR_OK, doc];
  }
}
