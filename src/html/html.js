// Utilities for working with html strings

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
function html_replace_tags(input_string, replacement_string) {
  'use strict';

  ASSERT(typeof input_string === 'string');

  // Fast case for empty strings
  // Because of the assert this basically only checks 0 length
  if(!input_string)
    return input_string;

  // Parse the html into a Document object
  const doc = document.implementation.createHTMLDocument();
  const body_element = doc.body;
  body_element.innerHTML = input_string;

  // The native solution is faster but its behavior may not be
  // perfectly reproduced by the non native code below
  if(!replacement_string)
    return body_element.textContent;

  const node_iterator = doc.createNodeIterator(body_element,
    NodeFilter.SHOW_TEXT);
  const node_values = [];
  for(let node = node_iterator.nextNode(); node;
    node = node_iterator.nextNode())
    node_values.push(node.nodeValue);
  return node_values.join(replacement_string);
}

// Accepts an html input string and returns a truncated version of the input,
// while maintaining a higher level of well-formedness over a naive truncation.
// This is currently a lossy transformation because certain entities that are
// decoded while processing are not properly re-encoded.
function html_truncate(html_string, position, extension_string) {
  'use strict';

  ASSERT(Number.isInteger(position));
  ASSERT(position >= 0);

  if(!html_string)
    return '';

  const ellipsis = '\u2026';
  const extension = typeof extension_string === 'string' ?
    extension_string : ellipsis;

  let is_past_position = false;
  let total_length = 0;

  // Parse the html into a Document object
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html_string;

  // Create an iterator for iterating over text nodes
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(is_past_position) {
      node.remove();
      continue;
    }

    const value = node.nodeValue;
    const value_length = value.length;
    if(total_length + value_length >= position) {
      is_past_position = true;
      const remaining_length = position - total_length;
      node.nodeValue = value.substr(0, remaining_length) + extension;
    } else
      total_length += value_length;
  }

  return /<html/i.test(html_string) ?
    doc.documentElement.outerHTML : doc.body.innerHTML;
}
