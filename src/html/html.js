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

// Truncates an HTML string
// @param html_string {String}
// @param position {Number} position after which to truncate
// @param suffix {String} optional, appended after truncation, defaults to an
// ellipsis
export function html_truncate(html_string, position, suffix) {
  assert(Number.isInteger(position) && position >= 0);

  if (typeof html_string !== 'string') {
    return '';
  }

  const ELLIPSIS = '\u2026';
  if (typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  let document;
  try {
    document = html_parse(html_string);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  // Search for the text node in which truncation should occur and truncate it
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

  // Remove remaining nodes past the truncation point
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  return html_is_fragment(html_string) ? document.body.innerHTML :
                                         document.documentElement.outerHTML;
}

function html_is_fragment(html_string) {
  return !/<html/i.test(html_string);
}

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then this removes the tags.
export function html_replace_tags(html_string, replacement) {
  assert(typeof html_string === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if (!html_string) {
    return html_string;
  }

  if (replacement) {
    assert(typeof replacement === 'string');
  }

  let document;
  try {
    document = html_parse(html_string);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  if (!replacement) {
    return document.body.textContent;
  }

  // Shove the text nodes into an array and then join by replacement
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  const node_values = [];
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node_values.push(node.nodeValue);
  }

  return node_values.join(replacement);
}

// When html is a fragment, it will be inserted into a new document using a
// default template provided by the browser, that includes a document element
// and usually a body. If not a fragment, then it is merged into a document
// with a default template.
export function html_parse(html_string) {
  assert(typeof html_string === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(error.textContent.replace(/\s{2,}/g, ' '));
  }
  return document;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
