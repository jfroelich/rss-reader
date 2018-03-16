import * as html_parser from '/src/html-parser/html-parser.js';

// Given an input value, if it is a string, then creates and returns a new
// string where html entities have been decoded into corresponding values. For
// example, '&lt;' becomes '<'. Adapted from
// https://stackoverflow.com/questions/1912501
const UNSAFE_PERSISTENT_WORKER_ELEMENT = document.createElement('div');
export function html_decode_entities(value) {
  const entity_pattern = /&[#0-9A-Za-z]+;/g;
  return typeof value === 'string' ?
      value.replace(
          entity_pattern,
          function replacer(entity) {
            UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = entity;
            const text = UNSAFE_PERSISTENT_WORKER_ELEMENT.innerText;
            UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = '';
            return text;
          }) :
      value;
}

// Returns a new string where certain 'unsafe' characters in the input string
// have been replaced with html entities. If input is not a string returns
// undefined.
// See https://stackoverflow.com/questions/784586 for reference
export function html_escape(html_string) {
  // TEMP: not replacing & due to common double encoding issue
  const escape_html_pattern = /[<>"']/g;
  if (typeof html_string === 'string') {
    return html_string.replace(escape_html_pattern, html_encode_first_char);
  }
}

// Returns the first character of the input string as an numeric html entity
function html_encode_first_char(string) {
  return '&#' + string.charCodeAt(0) + ';';
}

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then this removes the tags.
export function html_replace_tags(html_string, replacement) {
  assert(typeof html_string === 'string');

  // Fast case for empty strings
  if (!html_string) {
    return html_string;
  }

  if (replacement) {
    assert(typeof replacement === 'string');
  }

  let document;
  try {
    document = html_parser.parse(html_string);
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



function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
