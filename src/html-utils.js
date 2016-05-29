// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// HTML-related functionality.
const HTMLUtils = {};

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity.
//
// The input string should be encoded, meaning that it should contain
// character entities and tags.
//
// This is lossy. Certain entities will not appear in the output because this
// decodes and re-encodes entities, and some entities are not re-encoded, such
// as &#32;.
//
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
// TODO: this feels like it could be optimized. Right now it is doing
// multiple passes over the input: parsing into document, walking the doc,
// and testing if fragment. I would prefer using a one-pass algorithm. The
// problem is that manual string manipulation is slow and unsafe.
HTMLUtils.truncate = function(inputString, position, extensionString) {
  // NOTE: createHTMLDocument creates an inert document, meaning that images
  // are not pre-fetched, scripts are not evaluated, styles are not computed,
  // etc.
  // NOTE: using DOMParser is equivalent to createHTMLDocument
  // NOTE: I cannot use template, doc frag, insertAdjacentHTML, or any other
  // techniques, because of how it works when encountering input containing
  // out of body elements like <html><body>.

  const inertDocument = document.implementation.createHTMLDocument();
  inertDocument.documentElement.innerHTML = inputString;

  const textNodeIterator = inertDocument.createNodeIterator(
    inertDocument.body, NodeFilter.SHOW_TEXT);

  const ELLIPSIS = '\u2026';

  // TODO: rather than modify the parameter to the function, I should be
  // creating a new local variable.
  extensionString = extensionString || ELLIPSIS;

  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let value = null;
  let valueLength = 0;
  let remaining = 0;
  let node = textNodeIterator.nextNode();

  while(node) {
    // Once we are past the point of text node truncation, all other text
    // nodes should be removed
    if(!acceptingAdditionalTextNodes) {
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    // node.nodeValue returns a decoded value that does not contain the raw
    // entities, so we don't need to do any special entity handling
    value = node.nodeValue;
    valueLength = value.length;

    if(accumulatedLength + valueLength >= position) {
      // We are at the text node where truncation should occur
      // Flag that all later text nodes should be removed
      acceptingAdditionalTextNodes = false;
      // Calculate the distance into the current text node's value that should
      // be kept. It is the amount of room remaining based on how many
      // characters we have seen so far and the total amount of characters
      // allowed in the output (excluding tags and using decoded entities).
      remaining = position - accumulatedLength;
      // Set nodeValue to the truncated decoded value, it will be re-encoded
      // automatically.
      node.nodeValue = value.substr(0, remaining) + extensionString;
    } else {
      // We have not yet reached the text node where truncation starts, just
      // update the number of characters seen and retain this text node and
      // do not modify it
      accumulatedLength = accumulatedLength + valueLength;
    }

    node = textNodeIterator.nextNode();
  }

  // TODO: what if i add a dummy element to head before setting innerHTML
  // above, then check if it was moved to body after setting docEl.innerHTML?
  // Would that differentiate between the two situations? Also I would have to
  // make sure to remove the dummy prior to traversal because it would be
  // in the body.

  // If the input was a full document, then we want to return the full document
  // as a string. Otherwise, return just the descendants of the body element
  // that was implicitly added by createHTMLDocument and that was not part of
  // the input.
  const hasHTMLTag = /<html/i.test(inputString);
  if(hasHTMLTag) {
    return inertDocument.documentElement.outerHTML;
  } else {
    return inertDocument.body.innerHTML;
  }
};

// Parses an inputString containing html into a Document object
// This defers functionality to the browser. This way we mirror parsing
// behavior and reduce the chance of XSS. Also, manual parsing is sluggish
// and error prone.
// The document is flagged as html, which affects nodeName case.
// The document is inert, similar to XMLHttpRequest.responseXML, meaning that
// images/css are not pre-fetched, and various properties like computed style
// are not initialized.
// NOTE: if parsing html not within a document, this automatically wraps
// the html in <html><body></body></html>. If there already is a body, it
// just uses that.
// TODO: can this ever throw an exception? If so, document it, and make sure
// that dependent features handle it appropriately.
HTMLUtils.parseFromString = function(inputString) {
  const MIME_TYPE_HTML = 'text/html';
  const parser = new DOMParser();
  const document = parser.parseFromString(inputString, MIME_TYPE_HTML);
  return document;
};

// Returns a new string where html elements were replaced with the optional
// replacement string.
// TODO: this cannot use HTMLUtils.parseFromString because it is ambiguous
// regarding whether the input contains an <html> and <body> tag.
// See how I solved it in HTMLUtils.truncate
HTMLUtils.replaceTags = function(inputString, replacementString) {
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
};

// Returns a new string where <br>s have been replaced with spaces. This is
// intended to be rudimentary and fast rather than perfectly accurate. I do
// not do any heavy-weight html marshalling.
// TODO: does this mirror Chrome's behavior? Does chrome's parser allow
// for whitespace preceding the tag name? Maybe this should be stricter.
// I did some testing, I don't think you can have leading spaces before the
// tag name. So this shouldn't allow it.
// TODO: rather than this function existing, would it be nicer if stripTags
// accepted a list of tags to ignore or to only consider, and then the caller
// could just pass in br to that function as the only tag to consider
HTMLUtils.filterBreakruleTags = function(inputString) {
  const BREAK_RULE_PATTERN = /<\s*br\s*>/gi;
  return inputString.replace(BREAK_RULE_PATTERN, ' ');
};
