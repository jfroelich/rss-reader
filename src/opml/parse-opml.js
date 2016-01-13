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
