import assert from '/src/assert.js';
import * as string from '/src/lang-utils/string.js';

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
