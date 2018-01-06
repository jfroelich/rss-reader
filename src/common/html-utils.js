import assert from "/src/common/assert.js";
import * as Status from "/src/common/status.js";

// Given an input value, if it is a string, then creates and returns a new string where html
// entities have been decoded into corresponding values. For example, '&lt;' becomes '<'.
// Adapted from https://stackoverflow.com/questions/1912501
// TODO: i'd eventually like to not involve the dom but for now just get something working
// TODO: I believe the shared worker element technique is 'thread-safe' because all dom access
// is synchronous. Right? Pretty sure but never really verified.
const workerElement = document.createElement('div');
export function decodeEntities(value) {
  const entityPattern = /&[#0-9A-Za-z]+;/g;

  return typeof value === 'string' ? value.replace(entityPattern,
    function decodeEntitiesReplace(entityString) {
    // Set the value of the shared worker element. By using innerHTML this sets the raw value
    workerElement.innerHTML = entityString;

    // Now get the value back out. The accessor will do the decoding dynamically.
    // TODO: why innerText? probably should just use textContent? Wait until I implement a
    // testing lib to change.
    const text = workerElement.innerText;

    // Reset it each time to avoid leaving crap hanging around because worker element lifetime
    // is page lifetime not function scope lifetime
    workerElement.innerHTML = '';

    return text;
  }) : value;
}


// Returns a new string where certain 'unsafe' characters in the input string have been replaced
// with html entities. If input is not a string returns undefined.
// See https://stackoverflow.com/questions/784586 for reference
export function escapeHTML(htmlString) {
  // TEMP: not replacing & due to common double encoding issue
  const escapeHTMLPattern = /[<>"']/g;
  if(typeof htmlString === 'string') {
    return htmlString.replace(escapeHTMLPattern, encodeFirst);
  }
}

// Returns the first character of the input string as an numeric html entity
function encodeFirst(string) {
  return '&#' + string.charCodeAt(0) + ';';
}

// Truncates an HTML string
// @param htmlString {String}
// @param position {Number} position after which to truncate
// @param suffix {String} optional, appended after truncation, defaults to an ellipsis
export function truncateHTML(htmlString, position, suffix) {
  assert(Number.isInteger(position) && position >= 0);

  // Tolerate some bad input for convenience
  if(typeof htmlString !== 'string') {
    return '';
  }

  const ELLIPSIS = '\u2026';
  if(typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const [status, doc] = parseHTML(htmlString);
  if(status !== Status.OK) {
    return 'Unsafe html';
  }

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

// Replaces tags in the input string with the replacement. If no replacement, then removes the
// tags.
export function replaceTags(htmlString, replacement) {
  assert(typeof htmlString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!htmlString) {
    return htmlString;
  }

  if(replacement) {
    assert(typeof replacement === 'string');
  }

  const [status, doc, message] = parseHTML(htmlString);
  if(status !== Status.OK) {
    return 'Unsafe HTML redacted';
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

// When html is a fragment, it will be inserted into a new document using a default template
// provided by the browser, that includes a document element and usually a body. If not a fragment,
// then it is merged into a document with a default template.
export function parseHTML(htmlString) {
  if(typeof htmlString !== 'string') {
    throw new TypeError('Expected string, got ' + typeof htmlString);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const error = doc.querySelector('parsererror');
  return error ? [Status.EPARSEHTML, null, error.textContent.replace(/\s{2,}/g, ' ')] :
    [Status.OK, doc];
}
