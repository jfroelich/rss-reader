import assert from '/src/assert/assert.js';
import {parse_html} from '/src/html/html.js';

// TODO: db modules should not depend on html modules, unless html modules are
// a baser module. but, in general, it might be nice to just decouple

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
