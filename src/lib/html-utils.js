import {assert} from '/src/lib/assert.js';
import * as string_utils from '/src/lib/string-utils.js';

// Returns a new string where certain characters in the input string have been
// replaced with html entities. If input is not a string returns undefined.
// Adapted from https://stackoverflow.com/questions/784586.
export function escape_html(html) {
  const pattern = /[<>"'`&]/g;
  if (typeof html === 'string') {
    return html.replace(pattern, match => '&#' + match.charCodeAt(0) + ';');
  }
}

// Parses a string into an html document. When html is a fragment, it will be
// inserted into a new document using a default template provided by the
// browser, that includes a document element and usually a body. If not a
// fragment, then it is merged into a document with a default template.
export function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const error = doc.querySelector('parsererror');
  if (error) {
    const message = string_utils.condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return doc;
}

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then tags are removed.
// TODO: I do not think any callers actually use this for replacement purposes,
// it is always to remove tags, should probably rename and narrow purpose
export function replace_tags(html, replacement) {
  assert(typeof html === 'string');
  assert(replacement === undefined || typeof replacement === 'string');

  if (!html) {
    return html;
  }

  let doc;
  try {
    doc = parse_html(html);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  if (!replacement) {
    return doc.body.textContent;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  const node_values = [];
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node_values.push(node.nodeValue);
  }

  return node_values.join(replacement);
}

export function truncate_html(html_string, position, suffix) {
  if (typeof html_string !== 'string') {
    return '';
  }

  if (!Number.isInteger(position)) {
    throw new TypeError('position must be an integer');
  }

  if (position < 0) {
    throw new TypeError('position must be greater than or equal to 0');
  }

  const ELLIPSIS = '\u2026';
  if (typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html_string, 'text/html');
  const parser_error = doc.querySelector('parsererror');
  if (parser_error) {
    return '<html><body>Unsafe or malformed HTML</body></html>';
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
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
    return doc.documentElement.outerHTML;
  } else {
    return doc.body.innerHTML;
  }
}
