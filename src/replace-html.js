// See license.md

'use strict';

// TODO: switch to using tokenize_html once it settles

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
function replace_html(input_string, replacement_string) {

  // Parse the input string into an html document so that we can easily
  // walk the elements
  const doc = document.implementation.createHTMLDocument();
  const body_element = doc.body;
  body_element.innerHTML = input_string;

  // If there is no replacement string, then default to the browser's built-in
  // tag stripping function, which is simply accessing textContent. The exact
  // behavior may differ from below but it is very fast.
  if(!replacement_string)
    return body_element.textContent;

  // Find all text nodes, then join using the replacement as a delimiter,
  // which effectively replaces any elements with the replacement
  const node_iterator = doc.createNodeIterator(body_element,
    NodeFilter.SHOW_TEXT);
  const node_values = [];
  for(let node = node_iterator.nextNode(); node;
    node = node_iterator.nextNode())
    node_values.push(node.nodeValue);
  return node_values.join(replacement_string);
}
