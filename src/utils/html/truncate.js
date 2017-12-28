import assert from "/src/utils/assert.js";
import parseHTML from "/src/utils/html/parse.js";

const ELLIPSIS = '\u2026';

// Truncates an HTML string
// @param htmlString {String}
// @param position {Number} position after which to truncate
// @param suffix {String} optional, appended after truncation, defaults to an ellipsis
// @throws HTMLParseError
export default function truncate(htmlString, position, suffix) {
  assert(Number.isInteger(position) && position >= 0);

  // Tolerate some bad input for convenience
  if(typeof htmlString !== 'string') {
    return '';
  }

  if(typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const doc = parseHTML(htmlString);

  // Search for the text node in which truncation should occur and truncate it
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  let totalLength = 0;

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

  // parseHTML introduces body text for fragments. If full text then return full text, otherwise
  // strip the added elements

  return isNotFragment(htmlString) ? doc.documentElement.outerHTML : doc.body.innerHTML;
}

function isNotFragment(htmlString) {
  return /<html/i.test(htmlString);
}
