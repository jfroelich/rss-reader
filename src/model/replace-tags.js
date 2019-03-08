import {assert} from '/src/assert.js';
import {parse_html} from '/src/parse-html/parse-html.js';

// TODO: no callers use this for the purpose of replacement. all use it only
// for removing tags. this should be renamed to strip-tags and the replacement
// parameter should be dropped.


// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then tags are removed.
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
