import {assert} from '/src/lib/assert.js';

// The legible_text_filter removes text nodes from the input document that the
// filter considers illegible due to having too small of a font size.
//
// This filter makes decisions based on CSS values. For better fidelity to
// author intent, this should be run before CSS values are filtered by any other
// filters, such as a by a filter that removes link/style elements, or a filter
// that removes style attributes.
//
// The filter accepts a required |options| parameter with a required property
// |min_font_size| that must be an integer, or an assertion error is thrown.

// NOTE: this is a very raw first draft, probably several things wrong, I am
// trying to proceed despite not having a clear vision for the implementation.
// NOTE: unless otherwise specified, all units are in pixels

// TODO: does style.fontSize yield pts or px?

// TODO: this is another opportunity to learn about CSSOM, which may be relevant

// TODO: this initial impl calls getComputedStyle twice. I am unsure if
// computation is memoized or how browsers implement getComputedStyle, I just
// know that it tends to have horrible performance. I think I need a different
// approach where I call getComputedStyle only once per element. In addition, I
// do not love how this iterates twice when it could be done in a single
// iteration.

// TODO: consider mark-sweep approach, where I break up the classification step
// and the prune step. Similar to what I started doing in the boilerplate lib.
// Define a classify function that marks nodes. Provide an annotate function
// that produces an annotated document. Provide a prune function that
// appropriately removes the correct nodes.

// TODO: consider skipping whitespace nodes, if the cost of calculating whether
// a node is whitespace is less than the cost of processing the node like any
// other node. Also, if the author is doing something funky with custom font
// sizes for whitespace only text, it would probably be better to leave that
// text untouched.

// TODO: I am unsure if I am averaging the right thing. Not sure if total text
// node count is what I want. Maybe text length ignoring whitespace is a more
// accurate metric? I need to clarify what I am trying to measure. Basically I
// want to remove tiny text, unless most of the document is tiny. So I want to
// remove relatively tiny text.

// TODO: maybe I also want to enforce a minimum content length ratio similar to
// what was done in the boilerplate filter, so that the filter never removes too
// much text.

export function legible_text_filter(doc, options) {
  const min_font_size = options.min_font_size;
  assert(Number.isInteger(min_font_size));

  const avg_font_size = calc_avg_font_size(doc);
  if (avg_font_size < 1) {
    console.debug('Average font size is < 1', avg_font_size);
    return;
  }

  if (avg_font_size < (min_font_size + 2)) {
    console.debug(
        'Average font size is smaller than minimum tolerance', avg_font_size,
        min_font_size);
    return;
  }

  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const parent = node.parentNode;
    const style = getComputedStyle(parent);
    const font_size = parseInt(style.fontSize, 10);
    if (isNaN(font_size)) {
      console.debug('Could not determine text font size', node.nodeValue);
      continue;
    }

    if (font_size < min_font_size) {
      console.debug('Removing node with small font', node.nodeValue, font_size);
      // Only remove the text node, not its parent element, because that could
      // remove many other unrelated things. remove() is only available to
      // elements, so use the older syntax to remove the node
      parent.removeChild(node);
    }
  }
}

// Returns the average font size of text in the document
export function calc_avg_font_size(doc) {
  // TODO: consider imputing font size for those nodes where font size is
  // unknown. For example, consider a fallback to a default font size. However,
  // the problem then is how to choose a default font size. This is tricky if
  // the code is intended to support multiple devices where the default font
  // size varies by device.

  let total_font_size = 0;
  let text_node_count = 0;
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const parent = node.parentNode;
    const style = getComputedStyle(parent);
    const font_size = parseInt(style.fontSize, 10);
    if (!isNaN(font_size)) {
      total_font_size += font_size;
    }
    text_node_count++;
  }

  if (text_node_count < 1) {
    // TEMP: initial tracing, will remove
    console.debug('text_node_count < 1');
    return 0;
  }

  // TEMP: initial tracing, will remove
  console.debug(
      '%d text nodes, total font size %d, average font size %d',
      text_node_count, total_font_size, total_font_size / text_node_count);

  return total_font_size / text_node_count;
}
