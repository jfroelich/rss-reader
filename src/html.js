import {HTMLParser} from "/src/html-parser.js";
import {assert, isPosInt, isUncheckedError} from "/src/rbl.js";

// Returns a new string where certain 'unsafe' characters in the input string
// have been replaced with html entities. If input is not a string returns
// undefined.
export function htmlEscape(htmlString) {
  if(typeof htmlString === 'string') {
    // See https://stackoverflow.com/questions/784586 for reference
    // TEMP: not replacing & due to common double encoding issue
    const HTML_PATTERN = /[<>"']/g;
    return htmlString.replace(HTML_PATTERN, encodeFirst);
  }
}

// Returns the first character of the input string as an numeric html entity
function encodeFirst(string) {
  return '&#' + string.charCodeAt(0) + ';';
}

// Replaces html tags in the input string with the replacement. If no
// replacement, then removes the tags.
export function htmlReplaceTags(htmlString, replacement) {
  assert(typeof htmlString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!htmlString) {
    return htmlString;
  }

  if(replacement) {
    assert(typeof replacement === 'string');
  }

  let doc;

  // TODO: do not catch?
  try {
    doc = HTMLParser.parseDocumentFromString(htmlString);
  } catch(error) {
    if(isUncheckedError(error)) {
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
// @throws ParserError
export function htmlTruncate(htmlString, position, suffix) {
  assert(isPosInt(position));

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
