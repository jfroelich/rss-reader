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
// TODO: How does this work when the html is not a document? Does this just
// generate a node tree with a fake root node? Or does it auto-generate
// a doc and body and insert the html into the body? Or something else?
// TODO: can this ever throw an exception? If so, document it, and make sure
// that dependent features handle it appropriately.
function html_parse_string(inputString) {
  'use strict';

  // Defer to the browser. This way we mirror parsing behavior
  // and reduce the chance of XSS. Also, manual parsing seems sluggish
  // and error prone.

  const MIME_TYPE_HTML = 'text/html';
  const parser = new DOMParser();
  const document = parser.parseFromString(inputString, MIME_TYPE_HTML);
  return document;
}

// Returns a new string where html elements were replaced with the optional
// replacement string.
// TODO: what if there is no document element resulting from parsing? how
// does that work? Is it implicit? Am I accidentally introducing content?
// TODO: is selecting all text nodes into an array seems like it is not
// ideal performance. Think of a better way. Maybe inline the functions
// and avoid using map.
function html_replace(inputString, replacementString) {
  'use strict';

  // TODO: is it even correct to guard against undefined/null here? I am not
  // guarding against type.
  if(!inputString) {
    return;
  }

  // NOTE: dom_select_text_nodes is not restricted to text nodes
  // in the body. Which again is related to the unclear behavior of parsing
  // a non-document html string such as "<element>text</element>"
  // TODO: but it should be restricted to the body. In fact, text nodes
  // outside the body should be ignored or even implicitly removed by
  // not being returned or joined into the return value.

  let outputString = null;
  const document = html_parse_string(inputString);
  if(replacementString) {
    const nodes = dom_select_text_nodes(document);
    const values = nodes.map(dom_get_node_value);
    outputString = values.join(replacementString);
  } else {
    outputString = document.documentElement.textContent;
  }

  return outputString;
}

// Returns a new string where <br>s have been replaced with spaces. This is
// intended to be rudimentary and fast rather than perfectly accurate. I do
// not do any heavy-weight html marshalling.
function html_replace_breakrules(inputString) {
  'use strict';
  // TODO: should I be guarding against undefined? My instict says no.
  // I am not sure. I am leaving this here for now because I guard in various
  // other plays so I am somewhat consistent, and because it isn't a perf
  // issue.
  // TODO: does this mirror Chrome's behavior? Does chrome's parser allow
  // for whitespace preceding the tag name? Maybe this should be stricter.

  const BREAK_RULE_PATTERN = /<\s*br\s*>/gi;

  if(inputString) {
    return inputString.replace(BREAK_RULE_PATTERN, ' ');
  }
}

// TODO: THIS FUNCTION IS NOT YET FULLY IMPLEMENTED. For now I just defer to
// normal string truncation. The truncation of a string is arbitrary with
// respect to html tags and could lead to truncating in the middle of a tag, or
// leave unclosed tags in the result. Think about how to prevent these issues.
// I could parse and then add up texts until I get to the desired length I
// suppose?
function html_truncate(inputString, position, extensionString) {
  'use strict';
  return string_truncate(inputString, position, extensionString);
}
