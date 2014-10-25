// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Parses the string into an XMLDocument. If the XML is invalid, an exception
 * is thrown. Returns an XMLDocument instance, which is also an instance of
 * a Document object.
 */
lucu.parseXML = function(string) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(string, 'application/xml');
  if(!doc || !doc.documentElement) {
    throw new SyntaxError('Invalid xml');
  }

  var error = doc.documentElement.querySelector('parsererror');
  if(error) {
    console.debug('XML parsing error %o', error);
    throw new SyntaxError(error.textContent);
  }

  return doc;
};
