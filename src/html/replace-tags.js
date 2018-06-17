import {parse_html} from '/src/html/parse-html.js';

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then this removes the tags.
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
