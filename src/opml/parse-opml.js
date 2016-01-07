// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Parses an opml xml document string into a document. Throws an exception
// if an error occurs.
// Requires: parseXML
function parseOPML(string) {
  'use strict';

  // NOTE: we don't trap exceptions here, we let them bubble
  const document = parseXML(string);

  if(!document.documentElement.matches('opml')) {
    throw new Error('Invalid document element: ' +
      document.documentElement.localName);
  }

  return document;
}
