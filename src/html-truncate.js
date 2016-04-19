// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/string.js

// TODO: there are several callers of string_truncate in other files where the
// text may contain html entities. Those call sites should be
// modified to use html_truncate instead so that entities are handled properly.
// TODO: use the encoding approach outlined in html-truncate2.js here and
// stop using the dummy element approach, then delete html-truncate2.js
// TODO: remove dependency on string_truncate, do the truncation here
// TODO: extension string should be encoded or documented that it should be
// ready to be inserted into html as is

function html_truncate(inputString, position, extensionString) {
  'use strict';

  // NOTE: this check behaves incorrectly in cases such as:
  // <html in javascript string literal in script tag
  // <html in comment
  // <html in attribute value
  // malformed html such as multiple document elements
  // I gave up on trying other approaches. As a result, however, this entire
  // function can possibly behave incorrectly in such cases.
  // Also, I am not bothering to do the additional checks for <body>. I just
  // assume that if <html> is present then <body> or <frameset> are present.
  const hasHTMLTag = /<html/i.test(inputString);

  const inertDocument = document.implementation.createHTMLDocument();
  inertDocument.documentElement.innerHTML = inputString;

  // Restrict to text nodes within body, regardless of whether <body>
  // is present in the input string.
  const textNodeIterator = inertDocument.createNodeIterator(inertDocument.body,
    NodeFilter.SHOW_TEXT);

  let truncatedDecodedValue = null;
  let decodedValue = null;
  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let encodedValue = null;
  let decodedValueLength = null;
  let node = textNodeIterator.nextNode();

  while(node) {

    if(!acceptingAdditionalTextNodes) {
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    encodedValue = node.nodeValue;
    decodedValue = html_truncate_decode_entities_unsafe(encodedValue);
    decodedValueLength = decodedValue.length;

    if(accumulatedLength + decodedValueLength > position) {
      acceptingAdditionalTextNodes = false;
      truncatedDecodedValue = string_truncate(decodedValue,
        position - accumulatedLength, extensionString);
      node.nodeValue = html_truncate_encode_entities(truncatedDecodedValue);
    } else {
      accumulatedLength = accumulatedLength + decodedValueLength;
    }

    node = textNodeIterator.nextNode();
  }

  if(hasHTMLTag) {
    return inertDocument.documentElement.outerHTML;
  } else {
    return inertDocument.body.innerHTML;
  }
}

// This is created once sits forever in memory. In theory this means that
// the encode/decode functions will perform faster.
// TODO: look closer into maximum text node length and maximum string value
// lengths for possible issues.
// TODO: look into a simpler way of doing this that doesn't involve using a
// dummy element.
const HTML_TRUNCATE_DUMMY_ELEMENT = document.createElement('p');

// Clear the contents of HTML_TRUNCATE_DUMMY_ELEMENT so its contents are not
// sitting around in memory forever, which would be bad for very large strings,
// and so that it does not expose sensitive data.
function html_truncate_clear_dummy_element() {
  'use strict';
  HTML_TRUNCATE_DUMMY_ELEMENT.textContent = '';
}

// Simple helper to take a raw node value that contains entities such as
// '&amp;' or '&nbsp;' and replaces them with their character equivalents.
// For example, converts 'a&amp;b' to 'a&b'
// DO NOT USE ON ANYTHING OTHER THAN SIMPLE TEXT NODE VALUE OR
// RISK XSS. This sets a live element's innerHTML to decode the entities,
// so if <script> tags or similar are present this can be exploited.
function html_truncate_decode_entities_unsafe(encodedStringWithoutHTMLTags) {
  'use strict';
  HTML_TRUNCATE_DUMMY_ELEMENT.innerHTML = encodedStringWithoutHTMLTags;
  const decoded = HTML_TRUNCATE_DUMMY_ELEMENT.textContent;
  html_truncate_clear_dummy_element();
  return decoded;
}

// Simple helper that accepts an unencoded string and encodes it, replacing
// characters with entity code equivalents when necessary.
// For example, converts 'a&b' to 'a&amp;b' or 'a<b' to 'a&lt;b'.
// NOTE: Once &nbsp; converts to space in decode, this will not convert the
// space back to &nbsp;.
// NOTE: may lose original form, e.g. &nbsp; could be swapped with &#32;, it
// isn't clear. The browser decides whether to use numerical or character based
// code forms. I think the browser generally uses character based. So basically
// if the input has &1234; and goes through decode/encode it may end up in the
// output as &abcd;.
// NOTE: could lose left-zero padding. If decode encode cycle maintains
// the numerical code, there is still issue of optional leading zeros, and
// those may be implicitly chopped. &0001; could become &1;.
function html_truncate_encode_entities(decodedHTMLString) {
  'use strict';
  HTML_TRUNCATE_DUMMY_ELEMENT.textContent = decodedHTMLString;
  const encoded = HTML_TRUNCATE_DUMMY_ELEMENT.innerHTML;
  html_truncate_clear_dummy_element();
  return encoded;
}
