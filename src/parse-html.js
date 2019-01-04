import assert from '/src/assert.js';
import {condense_whitespace} from '/src/condense-whitespace.js';

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
