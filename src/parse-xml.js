// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Parses the given xml string into a Document object. Throws an exception if a
// parsing error occurs
// @param inputString {String}
// @returns {Document}
function parseXML(inputString) {
  console.assert(inputString);
  const parser = new DOMParser();
  // Allow the possible exception to bubble by not catching it
  const document = parser.parseFromString(inputString, 'application/xml');

  // If an error did not occur then these should always be defined
  console.assert(document);
  console.assert(document.documentElement);

  // Translate the embedded error back into an exception
  const embeddedErrorElement = document.querySelector('parsererror');
  if(embeddedErrorElement) {
    throw new Error(embeddedErrorElement.textContent);
  }

  return document;
}
