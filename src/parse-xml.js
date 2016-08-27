// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Parses the given xml string into a Document object. Throws an exception if a
// parsing error occurs
// @param xml_string {String}
// @returns {Document}
function parse_xml(xml_string) {
  console.assert(xml_string);
  const parser = new DOMParser();
  // Allow the possible exception to bubble by not catching it
  const document = parser.parseFromString(xml_string, 'application/xml');
  console.assert(document);

  // Translate the embedded error back into an exception
  const embedded_error = document.querySelector('parsererror');
  if(embedded_error) {
    throw new Error(embedded_error.textContent);
  }

  return document;
}
