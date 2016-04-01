// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/string.js

// Parses an inputString containing html into a Document object
// NOTE: is practically equivalent to using DOMParser. I took a look a while
// ago at the internals of DOMParser in webkit/chrome and it basically
// does the exact same thing. one issue though is whether domparser sets
// the body inner html or the documentelement innerhtml. this would be something
// to review.
// NOTE: we do not need to check whether the html variable is defined because
// setting the innerHTML property to undefined has no effect.
// NOTE: doc does not have an innerHTML property, so we have to use
// documentElement. Setting doc.innerHTML is basically only defining a new,
// useless, expando property on the document instance.
// TODO: review whether this throws an exception or does the funky embedded
// parsererror element like what happens when parsing invalid xml
// TODO: all functionality that involves parsing html in the app should be
// using this function. I think there are a few places in other files that do
// not use this.
// TODO: if the document element has only one child and it is <html>, the
// child should be unwrapped
function html_parse(inputString) {
  'use strict';
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = inputString;
  return doc;
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
