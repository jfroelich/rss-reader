// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// HTML-related functionality.
// TODO: I am not sure if this all belongs together. Yes, these all deal with
// HTML. However, one deals with parsing, and some others deal with various
// sanitization functions. Maybe I should be organizing more by each function's
// purpose rather than its input-output type similarity.

// Requires: /src/dom.js
// Requires: /src/string.js

// Parses an inputString containing html into a Document object
// The document is flagged as html, which affects nodeName case.
// The document is inert, similar to XMLHttpRequest.responseXML, meaning that
// images/css are not pre-fetched, and various properties like computed style
// are not initialized.
// NOTE: if parsing html not within a document, this automatically wraps
// the html in <html><body></body></html>. If there already is a body, it
// just uses that and does not rewrap.


// TODO: can this ever throw an exception? If so, document it, and make sure
// that dependent features handle it appropriately.
function html_parse_string(inputString) {
  'use strict';

  // Defer to the browser. This way we mirror parsing behavior
  // and reduce the chance of XSS. Also, manual parsing seems sluggish
  // and error prone.

  // NOTE: this will automatically create wrapping doc and body element
  // around the content. This may not be what someone wants. The consumer
  // has to be careful.

  const MIME_TYPE_HTML = 'text/html';
  const parser = new DOMParser();
  const document = parser.parseFromString(inputString, MIME_TYPE_HTML);
  return document;
}

// Returns a new string where html elements were replaced with the optional
// replacement string.
function html_replace(inputString, replacementString) {
  'use strict';

  // NOTE: this cannot use html_parse_string because it is ambiguous regarding
  // whether the input contains an <html> and <body> tag.
  // See how I solved it in html-truncate.js

  let outputString = null;

  const doc = document.implementation.createHTMLDocument();
  const bodyElement = doc.body;
  bodyElement.innerHTML = inputString;

  if(replacementString) {

    const it = doc.createNodeIterator(bodyElement, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    const nodeValueBuffer = [];
    while(node) {
      nodeValueBuffer.push(node.nodeValue);
      node = it.nextNode();
    }

    outputString = nodeValueBuffer.join(replacementString);
  } else {
    outputString = bodyElement.textContent;
  }

  return outputString;
}

// Returns a new string where <br>s have been replaced with spaces. This is
// intended to be rudimentary and fast rather than perfectly accurate. I do
// not do any heavy-weight html marshalling.
// TODO: does this mirror Chrome's behavior? Does chrome's parser allow
// for whitespace preceding the tag name? Maybe this should be stricter.
function html_replace_breakrules(inputString) {
  'use strict';
  const BREAK_RULE_PATTERN = /<\s*br\s*>/gi;
  return inputString.replace(BREAK_RULE_PATTERN, ' ');
}
