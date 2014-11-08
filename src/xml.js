// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Parses the string into an XMLDocument. If the XML is invalid, an exception
 * is thrown. Returns an XMLDocument instance, which is also an instance of
 * a Document object.
 *
 * TODO: is SyntaxError inappropriate?
 */
lucu.parseXML = function(string) {
  'use strict';
  var parser = new DOMParser();
  var document = parser.parseFromString(string, 'application/xml');
  if(!document || !document.documentElement) {
    throw new SyntaxError('Invalid xml');
  }

  // TODO: why query from document element instead of document?

  var error = document.documentElement.querySelector('parsererror');
  if(error) {
    console.debug('XML parsing error %o', error);
    throw new SyntaxError(error.textContent);
  }

  return document;
};
