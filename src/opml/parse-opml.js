// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /xml/parse-xml.js

// Parses an opml xml document string into a document. Throws an exception
// if an error occurs.
function parseOPML(string) {
  'use strict';

  // NOTE: we don't trap exceptions here, we let them bubble
  const document = parseXML(string);

  if(!document.documentElement.matches('opml')) {
    // TODO: use the new string template syntax?
    throw new Error('Invalid document element: ' +
      document.documentElement.localName);
  }

  return document;
}


// Parses an xml input string and returns a document. Throws an exception when
// an error occurs. Verifies the document is defined and has a document element.
function parseXML(string) {
  'use strict';

  const parser = new DOMParser();
  const MIME_TYPE_XML = 'application/xml';
  const document = parser.parseFromString(string, MIME_TYPE_XML);

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
