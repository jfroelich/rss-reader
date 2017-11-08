'use strict';

// import net/mime.js
// import html-parser.js
// import rbl.js


function htmlSpecialChars(inputString) {
  const inputStringVarType = typeof inputString;
  if(inputStringVarType === 'undefined') {
    return '';
  } else {
    assert(inputStringVarType === 'string');
  }

  // Do a simple replacement of unsafe characters
  // TODO: do all the replacements at once using a regex
  let output = inputString;
  output = output.replace('<', '&lt;');
  output = output.replace('>', '&gt;');
  output = output.replace('"', '&quot;');

  return output;
}

// Replaces html tags in the input string with the replacement. If no
// replacement, then removes the tags.
// @throws AssertionError
function htmlReplaceTags(inputString, replacement) {
  assert(typeof inputString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!inputString) {
    return inputString;
  }

  if(replacement) {
    assert(typeof replacement === 'string');
  }

  let doc;

  // TODO: do not catch?
  try {
    doc = HTMLParser.parseDocumentFromString(inputString);
  } catch(error) {
    if(rbl.isUncheckedError(error)) {
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
// @throws ParserError
function htmlTruncate(htmlString, position, suffix) {
  assert(rbl.isPosInt(position));

  // Tolerate some bad input for convenience
  if(typeof htmlString !== 'string') {
    return '';
  }

  const ELLIPSIS = '\u2026';
  if(typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const doc = HTMLParser.parseDocumentFromString(htmlString);
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
