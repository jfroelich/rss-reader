import assert from '/src/assert.js';
import * as string from '/src/string-utils.js';

export function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  const error = document.querySelector('parsererror');
  if (error) {
    const message = string.condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return document;
}
