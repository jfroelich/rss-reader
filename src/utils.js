// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Detatches an element from the dom
function removeElement(element) {
  'use strict';
  element.remove();
}

// Replaces the element with its children
// NOTE: This is not optimized to be called on a live document. This causes a 
// reflow per move.
function unwrapElement(element) {
  'use strict';
  const parent = element.parentElement;

  // Avoid issues with documentElement or detached elements
  if(!parent) {
    return;
  }

  // Move each child of the element to the position preceding the element in
  // the parent's node list, maintaining child order.
  while(element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  // Now the element is empty so detach it
  element.remove();
}


// Found this somewhere I think on stackoverflow
function isValidDate(date) {
  'use strict';
  return date && date.toString() === '[object Date]' && isFinite(date);
}

function formatDate(date, sep) {
  'use strict';
 
  if(!date) {
    return '';
  }
  const parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(sep || '');
}


var lucu = lucu || {};

// String related utility functions
lucu.string = {};

// Scrubs tags
lucu.string.stripTags = function(string, replacement) {
  'use strict';
  if(!string) return;
  // TODO: rename doc to document?
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = string;
  if(!replacement) return doc.body.textContent;
  const iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node = doc.body;
  const values = [];
  while(node = iterator.nextNode()) {
    values.push(node.nodeValue);
  }
  return values.join(replacement);
};

// TODO: research the proper pattern
// /[^\x20-\x7E]+/g;
lucu.string.RE_CONTROL = /[\t\r\n]/g;

// Scrubs html from a string
lucu.string.stripControls = function(string) {
  'use strict';

  if(string) {
    return string.replace(lucu.string.RE_CONTROL,'');
  }
};

lucu.string.ELLIPSIS = '\u2026';

// Shorten a string if its too long
lucu.string.truncate = function(string, position, extension) {
  'use strict';

  extension = extension || lucu.string.ELLIPSIS;

  if(string && string.length > position) {
    return string.substr(0, position) + extension;
  }
  return string;
};

lucu.string.condenseWhitespace = function(string) {
  'use strict';
  if(string) {
    return string.replace(/\s+/,' ');
  }
};