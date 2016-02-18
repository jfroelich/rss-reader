// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/URI.js

// Misc. utility functions
const utils = {};

// Removes various binary characters from a string
utils.filterControlCharacters = function(string) {
  'use strict';
  if(string) {
    return string.replace(/[\t\r\n]/g, '');
  }
};

// Returns a url string without its protocol
utils.filterURLProtocol = function(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');
  // Remove the leading slashes before returning
  return uri.toString().substring(2);
};

// A quick and dirty way to get a formatted date
utils.formatDate = function(date, delimiter) {
  'use strict';
  if(!date) {
    return '';
  }
  const parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(delimiter || '');
};

// Returns the value of a dom node
utils.getNodeValue = function(node) {
  'use strict';
  return node.nodeValue;
};

// See http://stackoverflow.com/questions/1353684
utils.isValidDate = function(date) {
  'use strict';
  return date && date.toString() === '[object Date]' && isFinite(date);
};

// Returns true if the url is minimally valid
utils.isValidURL = function(url) {
  'use strict';
  try {
    let uri = URI(url);
    return uri && uri.protocol() && uri.hostname();
  } catch(e) {}
};

utils.parseHTML = function(html) {
  'use strict';
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html;
  return doc;
};

// Returns a new string where html elements were replaced with the optional
// replacement string.
utils.replaceHTML = function(inputString, replacement) {
  'use strict';
  let outputString = null;
  if(inputString) {
    const document = utils.parseHTML(inputString);
    if(replacement) {
      const nodes = utils.selectTextNodes(document);
      const values = nodes.map(utils.getNodeValue);
      outputString = values.join(replacement || '');
    } else {
      outputString = document.documentElement.textContent;
    }
  }

  return outputString;
};

// Returns a resolved url
utils.resolveURL = function(baseURL, url) {
  'use strict';
  try {
    const uri = new URI(url);
    if(!uri.protocol()) {
      const resolved = uri.absoluteTo(baseURL).toString();
      return resolved;
    }
  } catch(exception) {
    console.debug('Exception resolving url "%s": %o', url, exception);
  }

  return url;
};

// Applies a set of rules to a url string and returns a modified url string
utils.rewriteURL = function(url) {
  'use strict';
  const GOOGLE_NEWS =
    /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(url);
  if(matches && matches.length === 2 && matches[1]) {
    return decodeURIComponent(matches[1]);
  }
  return url;
};

// Returns a static array of all text nodes in a document
utils.selectTextNodes = function(document) {
  'use strict';
  const nodes = [];
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    nodes.push(node);
    node = iterator.nextNode();
  }
  return nodes;
};

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
utils.truncateString = function(string, position, extension) {
  'use strict';
  const ELLIPSIS = '\u2026';
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
};
