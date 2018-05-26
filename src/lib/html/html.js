import {parse_html} from '/src/lib/html/parse-html.js';

// HTML utility functions. These functions generally accept an html string as
// input and do something to or with that input string.

// TODO: split into separate files within an html folder that is within lib



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



function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
