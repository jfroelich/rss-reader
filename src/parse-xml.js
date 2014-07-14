// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Parses the string into an XMLDocument.
 * If the XML is invalid, an exception is thrown
 *
 * Returns the document (not documentElement), which
 * is a bit different than what parseHTML returns
 */
function parseXML(str) {
  var parser = new DOMParser();
  var xmlDocument = parser.parseFromString(str, 'application/xml');

  if(!xmlDocument || !xmlDocument.documentElement) {
    throw new SyntaxError('invalid xml');
  }

  // Check for the presence of a parsererror element in the output
  // and if so, undo the mixing of a parse exception event with
  // the parsed content, and throw an error instead
  var parserError = xmlDocument.documentElement.getElementsByTagName('parsererror');
  if(parserError && parserError.length) {

    // Only work with the first error element
    parserError = parserError[0];

    // Search for the text content of just the error message
    if(parserError.firstChild && parserError.firstChild.nextSibling) {
      parserError = parserError.firstChild.nextSibling.textContent;
      if(parserError) {
        throw new SyntaxError(parserError);
      }
    }

    // Fallback to just using an error message that may have tags
    throw new SyntaxError(parserError.textContent);
  }

  return xmlDocument;
}
