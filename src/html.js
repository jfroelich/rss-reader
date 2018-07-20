import assert from '/src/assert.js';
import * as string from '/src/string.js';

// Returns a new string where certain 'unsafe' characters in the input string
// have been replaced with html entities. If input is not a string returns
// undefined. See https://stackoverflow.com/questions/784586.
export function escape_html(html_string) {
  // TEMP: not replacing & due to common double encoding issue
  const escape_html_pattern = /[<>"'`]/g;
  if (typeof html_string === 'string') {
    return html_string.replace(escape_html_pattern, escape_html_encode);
  }
}

// Returns the first character of the input string as an numeric html entity
function escape_html_encode(string) {
  return '&#' + string.charCodeAt(0) + ';';
}

// Parses a string into an html document. When html is a fragment, it will be
// inserted into a new document using a default template provided by the
// browser, that includes a document element and usually a body. If not a
// fragment, then it is merged into a document with a default template.
export function parse_html(html_string) {
  assert(typeof html_string === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');

  const error = document.querySelector('parsererror');
  if (error) {
    const msg = string.condense_whitespace(error.textContent);
    throw new Error(msg);
  }

  return document;
}

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then this removes the tags.
export function replace_tags(html_string, replacement) {
  assert(typeof html_string === 'string');
  const typeof_replacement = typeof replacement;
  assert(typeof_replacement === 'undefined' || typeof_replacement === 'string');

  // Fast case for empty strings
  if (!html_string) {
    return html_string;
  }

  let document;
  try {
    document = parse_html(html_string);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  if (!replacement) {
    return document.body.textContent;
  }

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  const node_values = [];
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node_values.push(node.nodeValue);
  }

  return node_values.join(replacement);
}

// Similar to string truncation, but takes care not to truncate a string within
// the middle of an html tag or entity. The position is the position within the
// string in which to truncate. This position is based on the pure text offset
// (as if no tags existed), not the actual offset in the html string. May be an
// issue with how offset relates to entities, forgot what I did there. This is
// currently a very expensive operation. The document is parsed fully into a
// DOM, then the DOM is manipulated and then serialized back into an html
// string.
// Due to using DOMParser, this has no great way of knowing whether the original
// input html string was a fragment or a full document, so it uses a hack by
// looking for the substring "<html". This could turn out to be wrong sometimes.
// Eventually I would like to implement a pure text parser that avoids the DOM
// entirely. This is at conflict with the goal of using as much native
// functionality as possible because native functionality is extremely fast, and
// it guarantees the logic mirrors the browser's own input processing behavior.
export function truncate_html(html_string, position, suffix) {
  if (typeof html_string !== 'string') {
    return '';
  }

  if (!Number.isInteger(position)) {
    throw new TypeError('position must be an integer');
  }

  if (position < 0) {
    throw new TypeError('position must be positive');
  }

  const ELLIPSIS = '\u2026';
  if (typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');
  const error = document.querySelector('parsererror');
  if (error) {
    return 'Unsafe malformed html string';
  }

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let total_length = 0;

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const value_length = value.length;
    if (total_length + value_length >= position) {
      const remaining_length = position - total_length;
      node.nodeValue = value.substr(0, remaining_length) + suffix;
      break;
    } else {
      total_length += value_length;
    }
  }

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  if (/<html/i.test(html_string)) {
    return document.documentElement.outerHTML;
  } else {
    return document.body.innerHTML;
  }
}
