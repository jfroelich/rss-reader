'use strict';

// import base/assert.js
// import base/errors.js
// import base/number.js
// import net/mime.js

// Replaces html tags in the input string with the replacement. If no
// replacement, then removes the tags.
// @throws AssertionError
function htmlReplaceTags(inputString, replacement) {
  // The caller is responsible for calling this function with a defined string
  assert(typeof inputString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!inputString) {
    return inputString;
  }

  assert(typeof replacement === 'string');

  let doc;

  // TODO: do not catch
  try {
    doc = htmlParseFromString(inputString);
  } catch(error) {
    if(error instanceof AssertionError) {
      throw error;
    } else {
      return 'Unsafe HTML redacted';
    }
  }

  if(!replacement) {
    return doc.body.textContent;
  }

  // Shove the text nodes into an array and then join by replacement
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  const nodeValues = [];
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    nodeValues.push(node.nodeValue);
  }

  return nodeValues.join(replacement);
}

// Truncates an HTML string
// @param htmlString {String}
// @param position {Number} position after which to truncate
// @param suffix {String} optional, appended after truncation, defaults to
// an ellipsis
// @throws AssertionError
// @throws ParseError
function htmlTruncate(htmlString, position, suffix) {
  assert(numberIsPositiveInteger(position));

  // Tolerate some bad input for convenience
  if(typeof htmlString !== 'string') {
    return '';
  }

  const ELLIPSIS = '\u2026';
  if(typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const doc = htmlParseFromString(htmlString);
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  let totalLength = 0;
  // Search for the text node in which truncation should occur and truncate it
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const valueLength = value.length;
    if(totalLength + valueLength >= position) {
      const remainingLength = position - totalLength;
      node.nodeValue = value.substr(0, remainingLength) + suffix;
      break;
    } else {
      totalLength += valueLength;
    }
  }

  // Remove remaining nodes past the truncation point
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  return /<html/i.test(htmlString) ?
    doc.documentElement.outerHTML : doc.body.innerHTML;
}

// When htmlString is a fragment, it will be inserted into a new document
// using a default template provided by the browser, that includes a document
// element and usually a body. If not a fragment, then it is merged into a
// document with a default template.
// @throws AssertionError
// @throws ParseError
function htmlParseFromString(htmlString) {
  assert(typeof htmlString === 'string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, mime.HTML);
  assert(doc instanceof Document);
  const parserErrorElement = doc.querySelector('parsererror');
  if(parserErrorElement) {
    throw new ParseError(parserErrorElement.textContent);
  }
  return doc;
}
