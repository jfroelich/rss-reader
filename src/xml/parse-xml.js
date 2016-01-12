// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Parses an xml input string and returns a document. Throws an exception when
// an error occurs. Verifies the document is defined and has a document element.
function parseXML(string) {
  'use strict';

  const parser = new DOMParser();
  const mimeType = 'application/xml';
  const document = parser.parseFromString(string, mimeType);

  if(!document) {
    throw new Error('Undefined document');
  }

  if(!document.documentElement) {
    throw new Error('Undefined document element');
  }

  // NOTE: parsing errors are actually embedded within the
  // document itself instead of being thrown. Search for the error
  // and throw it
  const parserError = document.querySelector('parsererror');
  if(parserError) {
    // NOTE: the error message will include html-like content, not just
    // raw text
    throw new Error(parserError.textContent);
  }

  return document;
}
