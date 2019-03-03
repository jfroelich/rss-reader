import {assert} from '/src/lib/assert.js';

// NOTE: there is no point to using this filter in its current state. Without
// getComputedStyle availability it is horribly inaccurate and could
// unintentionally remove desired content.

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
  if (isNaN(avg_font_size)) {
    console.debug('Failed to calc average font size', doc.baseURI);
    return;
  }

  if (avg_font_size < 1) {
    console.debug('Average font size is < 1', avg_font_size);
    return;
  }

  if (avg_font_size < min_font_size) {
    console.debug(
        'Average font size is smaller than minimum', avg_font_size,
        min_font_size);
    return;
  }

  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const parent = node.parentNode;
    const font_size = get_element_font_size(parent);
    if (isNaN(font_size)) {
      console.debug('Could not determine text font size', node.nodeValue);
      continue;
    }

    if (font_size < min_font_size) {
      console.debug(
          'Removing text node with small font', node.nodeValue, font_size);
      parent.removeChild(node);
    }
  }
}

// Returns an element's font size
export function get_element_font_size(element, units = 'px') {
  // NOTE: in order to support processing of inert documents, we cannot use
  // getComputedStyle. Using element.style.fontSize is fickle because it means
  // we have to properly interpret values like 100%, 10px, 10em, etc. So, for
  // now, experiment with the new typed CSS object model approach and only
  // support pixel-based font sizes.
  // https://developers.google.com/web/updates/2018/03/cssom

  // TODO: somehow support relative size like percent and EM and smaller
  // TODO: support inherited CSS styles
  // TODO: support other CSS properties or html attribtues that affect font
  // size (e.g. zoom?).
  // TODO: maybe this belongs in its own library because there may be other
  // filters and modules that want to use this functionality.
  // TODO: consider returning a default value?

  // If map size is 0 then there are no inline properties, so exit. We could
  // skip this step, this may be a premature optimization, leaving it here for
  // now as a reference.
  const inline_property_count = element.attributeStyleMap.size;
  if (inline_property_count < 1) {
    return NaN;
  }

  let font_size_unit_value = element.attributeStyleMap.get('font-size');
  if (!font_size_unit_value) {
    return NaN;
  }

  // This can throw if the conversion is not supported, this only supports
  // physical metric conversion like in/cm/mm/px/pt
  try {
    font_size_unit_value = font_size_unit_value.to(units);
  } catch (error) {
    console.debug(error);
    return NaN;
  }
  return font_size_unit_value.value;
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
    text_node_count++;

    const parent = node.parentNode;
    const font_size = get_element_font_size(parent);
    if (!isNaN(font_size)) {
      total_font_size += font_size;
    }
  }

  if (text_node_count < 1) {
    return NaN;
  }

  // TEMP: initial tracing, will remove
  console.debug(
      '%d text nodes, total font size %d, average font size %d',
      text_node_count, total_font_size, total_font_size / text_node_count);

  return total_font_size / text_node_count;
}
