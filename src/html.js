// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// HTML-related functionality.
// TODO: I am not sure if this all belongs together. Yes, these all deal with
// HTML. However, one deals with parsing, and some others deal with various
// sanitization functions. Maybe I should be organizing more by each function's
// purpose rather than its input-output type similarity.

// Requires: /src/dom.js
// Requires: /src/string.js



// NOTE: the input string should be encoded, meaning that it should contain
// character entities where appropriate (and optionally tags).
// NOTE: because this manipulates node values using built in dom parsing,
// which does not provide access to raw encoded node values, entities
// in the input string may be different in the output. For example,
// a &#32; in the input will not appear in the output because it will be
// converted to a space and then not re-encoded in the output.
// NOTE: this accepts full document html and partial fragments of html. However,
// due to some issues with using the built in dom parsing functionality, this
// may behave strangely when encountering "<html" within a string literal
// in a javascript string in a script tag, or in a comment, or in an attribute
// value. In such cases the output may be wrapped in <html><body></body></html>
// even though the input string did not contain those tags.
// NOTE: when truncating an input string representing the full contents of a
// document (e.g. contains <html><body>), this only examines text nodes
// within the body. text nodes outside of the body are ignored. Also, text
// nodes outside of the body do not affect position.
// NOTE: extensionString is optional. If not set, "..." is used. If set, the
// string should be in decoded form (should NOT contain entities). It is
// not validated.

function html_truncate(inputString, position, extensionString) {
  // TODO: this feels like it could be optimized. Right now it is doing
  // multiple passes over the input: parsing into document, walking the doc,
  // and testing if fragment. I would prefer using a one-pass algorithm. The
  // problem is that manual string manipulation is slow and unsafe.

  // NOTE: createHTMLDocument creates an inert document, meaning that images
  // are not pre-fetched, scripts are not evaluated, styles are not computed,
  // etc.
  // NOTE: I cannot use template, doc frag, insertAdjacentHTML, or any other
  // techniques, because of how it works when encountering input containing
  // out of body elements like <html><body>.
  // NOTE: using DOMParser is equivalent to createHTMLDocument

  const inertDocument = document.implementation.createHTMLDocument();
  inertDocument.documentElement.innerHTML = inputString;

  const textNodeIterator = inertDocument.createNodeIterator(
    inertDocument.body,
    NodeFilter.SHOW_TEXT);

  const ELLIPSIS = '\u2026';
  extensionString = extensionString || ELLIPSIS;

  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let value = null;
  let valueLength = 0;
  let remaining = 0;
  let node = textNodeIterator.nextNode();

  while(node) {

    if(!acceptingAdditionalTextNodes) {
      // We are past the point of truncation, so this text node should be
      // deleted.
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    // node.nodeValue is decoded, it is not the raw input text
    value = node.nodeValue;
    valueLength = value.length;
    if(accumulatedLength + valueLength >= position) {
      // We are at the text node where truncation should occur
      acceptingAdditionalTextNodes = false;
      remaining = position - accumulatedLength;
      // Set nodeValue to the truncated decoded value, it will be encoded
      // automatically.
      node.nodeValue = value.substr(0, remaining) + extensionString;
    } else {
      // We have not yet reached the text node where truncation starts, just
      // update the number of characters seen
      accumulatedLength = accumulatedLength + valueLength;
    }

    node = textNodeIterator.nextNode();
  }

  // If the input was a full document, return the full document. Otherwise
  // return just the descendants of the body element that was implicitly
  // added by createHTMLDocument and that was not part of the input.

  // TODO: what if i add a dummy element to head before setting innerHTML
  // above, then check if it was moved to body after setting docEl.innerHTML?
  // Would that differentiate between the two situations? Also I would have to
  // make sure to remove the dummy prior to traversal because it would be
  // in the body.

  const hasHTMLTag = /<html/i.test(inputString);
  if(hasHTMLTag) {
    return inertDocument.documentElement.outerHTML;
  } else {
    return inertDocument.body.innerHTML;
  }
}

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
  // NOTE: this cannot use html_parse_string because it is ambiguous regarding
  // whether the input contains an <html> and <body> tag.
  // See how I solved it in html_truncate

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
  const BREAK_RULE_PATTERN = /<\s*br\s*>/gi;
  return inputString.replace(BREAK_RULE_PATTERN, ' ');
}
