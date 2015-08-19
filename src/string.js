// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.string = {};

// Scrubs tags
lucu.string.stripTags = function(string, replacement) {
  'use strict';
  if(!string) return;
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = string;
  if(!replacement) return doc.body.textContent;
  var iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node, values = [];
  while(node = iterator.nextNode()) {
    values.push(node.nodeValue);
  }
  return values.join(replacement);
};

// Scrubs html from a string
lucu.string.stripControls = function(string) {
  'use strict';
  // TODO: research the proper pattern
  // var p = /[^\x20-\x7E]+/g;
  var p = /[\t\r\n]/g;
  return string && string.replace(p,'');
};

// Shorten a string if its too long
lucu.string.truncate = function(string, position, extension) {
  'use strict';

  // \u2026 == ellipsis
  if(!string) return;
  if(string.length > position)
    return string.substr(0, position) + (extension || '\u2026');
  return string;
};

lucu.string.condenseWhitespace = function(string) {
  'use strict';
  if(string) {
    return string.replace(/\s+/,' ');
  }
};

