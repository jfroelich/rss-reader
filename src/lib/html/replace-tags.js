import {parse_html} from '/src/lib/html/parse-html.js';

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then this removes the tags.
//
// TODO: parse_html really doesn't do that much. This could decouple from it
// rather easily. Less coupling is better. After all I kind of do not like at
// all how this involves using DOMParser so this would seem like a step in the
// direction of using an alternative. I think when I first coupled it was
// because of DRY concern and fascination with reuse but now I am thinking that
// due to the low level of abstraction, the rather small amount of savings in
// LOC, etc, and low level of concern over needing to abstract away security
// issues or such, that it would be better as separate. Plus, I get to remove
// the try/catch, which I abhor.
export function replace_tags(html_string, replacement) {
  if (typeof html_string !== 'string') {
    throw new TypeError('html_string is not a string');
  }

  if (replacement && typeof replacement !== 'string') {
    throw new TypeError('replacement is defined but not a string');
  }

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
