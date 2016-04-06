// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/string.js

// Parses an inputString containing html into a Document object
// TODO: if the document element has only one child and it is <html>, the
// child should be unwrapped
function html_parse(inputString) {
  'use strict';
  //const doc = document.implementation.createHTMLDocument();
  //doc.documentElement.innerHTML = inputString;
  //return doc;

  const parser = new DOMParser();
  const document = parser.parseFromString(inputString, 'text/html');
  return document;
}

// Returns a new string where html elements were replaced with the optional
// replacement string.
function html_replace(inputString, replacementString) {
  'use strict';
  let outputString = null;
  if(inputString) {
    const document = html_parse(inputString);
    if(replacementString) {
      const nodes = html_dom_select_text_nodes(document);
      const values = nodes.map(html_dom_get_node_value);
      outputString = values.join(replacementString);
    } else {
      outputString = document.documentElement.textContent;
    }
  }

  return outputString;
}

// Returns a static array of all text nodes in a document
// Helper function for html_replace
function html_dom_select_text_nodes(document) {
  'use strict';
  const nodes = [];
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);

  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    nodes.push(node);
  }

  return nodes;
}

// Returns the value of a dom text node
function html_dom_get_node_value(textNode) {
  'use strict';
  return textNode.nodeValue;
}

// Returns a new string where <br>s have been replaced with spaces
function html_replace_breakrules(inputString) {
  'use strict';
  if(inputString) {
    return inputString.replace(/<\s*br\s*>/gi, ' ');
  }
}

// THIS FUNCTION IS NOT YET FULLY IMPLEMENTED. For now I just defer to normal
// string truncation.
// TODO: the truncation of html is arbitrary with
// respect to tags and could lead to truncating in the middle of a tag, or
// leave unclosed tags in the result. Think about how to
// prevent these issues. I could parse and then add up texts until I get to
// the desired length I suppose.
function html_truncate(inputString, position, extension) {
  'use strict';
  return string_truncate(inputString, position, extension);
}
