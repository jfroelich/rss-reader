import assert from '/src/assert.js';

export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
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
  const document = parser.parseFromString(html_string, 'text/html');
  const parser_error = document.querySelector('parsererror');
  if (parser_error) {
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

export function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  const error = document.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return document;
}

export function url_get_extension(url) {
  const path = url.pathname;

  if (path.length > 2) {
    const last_dot_pos_p1 = path.lastIndexOf('.') + 1;
    if (last_dot_pos_p1 > 0 && last_dot_pos_p1 < path.length) {
      const ext = path.substring(last_dot_pos_p1);
      if (ext.length < 5 && is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

export function is_alphanumeric(value) {
  return !/[^\p{L}\d]/u.test(value);
}

export function escape_html(html) {
  const pattern = /[<>"'`]/g;
  if (typeof html === 'string') {
    return html.replace(pattern, encode_first_character);
  }
}

function encode_first_character(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
