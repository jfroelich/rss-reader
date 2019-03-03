import {assert} from '/src/lib/assert.js';

// NOTE: there is no point to using this filter in its current state. Without
// getComputedStyle availability it is horribly inaccurate and could
// unintentionally remove desired content.

// The filter removes text nodes from the input document that the filter
// considers illegible due to having too small of a font size.
//
// This filter makes decisions based on CSS values. For better fidelity to
// author intent, this should be run before CSS values are filtered by any other
// filters, such as a by a filter that removes link/style elements, or a filter
// that removes style attributes.

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



// TODO: maybe I also want to enforce a minimum content length ratio similar to
// what was done in the boilerplate filter, so that the filter never removes too
// much text.

// |doc| required, must be of type Document. |min_font_size| required, must be
// of type CSSUnitValue, must use a CSS unit type such as 'px' or 'in' or 'mm'
// or 'cm'.
export function legible_text_filter(doc, min_font_size) {
  assert(min_font_size instanceof CSSUnitValue);

  // We are only investigating nodes within body. Without a body, there is no
  // benefit to analysis, so exit.
  if (!doc.body) {
    return;
  }

  // Calculate the average font size using the same units as the minimum font
  // size, for simple comparison. If indeterminate, it is unsafe to prune, so
  // exit early.
  const avg_font_size = calc_avg_font_size(doc, min_font_size.unit);
  if (!avg_font_size) {
    return;
  }

  // If the average font size is an outlier, it indicates something unexpected,
  // so it is unsafe to prune, so give up.
  if (avg_font_size.to('px').value < 1) {
    return;
  }

  // If the document, on average, has a small font size, then we should not do
  // any pruning so as to avoid blanking the document.
  if (avg_font_size.value < min_font_size.value) {
    return;
  }

  // Iterate over text nodes within the body and remove text nodes with a small
  // font size.
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const font_size =
        get_element_font_size(node.parentNode, min_font_size.unit);
    if (font_size && font_size.value < min_font_size.value) {
      console.debug('Removing node', node.nodeValue);
      node.parentNode.removeChild(node);
    }
  }
}

// Returns an element's font size as a CSSUnitValue or undefined if there is
// any problem. Currently this only examines inline CSS. Note this assumes the
// browser supports Element.attributeStyleMap.
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

  const font_size = element.attributeStyleMap.get('font-size');
  if (font_size) {
    // This can throw if the conversion is not supported, this only supports
    // physical metric conversion like in/cm/mm/px/pt. For example, the value
    // 100%, with unit percent, will cause an error.
    try {
      return font_size.to(units);
    } catch (error) {
    }
  }
}

// Returns the average font size of involved text in the document as a
// CSSUnitValue, or undefined if there was a problem. Throws an error if doc is
// not a Document or units is not a valid value for CSSUnitValue units.
// TODO: consider imputing unknown font size
export function calc_avg_font_size(doc, units = 'px') {
  if (!doc.body) {
    return;
  }

  let total_size = 0, node_count = 0;
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    if (node_has_content(node)) {
      const font_size = get_element_font_size(node.parentNode, units);
      if (font_size) {
        total_size += font_size.value;
        node_count++;
      }
    }
  }

  if (node_count) {
    return new CSSUnitValue(total_size / node_count, units);
  }
}

// TODO: consider explicit visibility check? for now rely on vis filter.
export function node_has_content(node) {
  return node.nodeValue.trim() ? true : false;
}
