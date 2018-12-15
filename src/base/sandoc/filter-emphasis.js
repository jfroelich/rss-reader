import assert from '/src/assert.js';
import {unwrap_element} from '/src/base/unwrap-element.js';

// NOTE: whitespace is completely stripped prior to analysis. This threshold
// parameter applies to the non-whitespace length.

export function filter_emphasis(document, text_length_max = 0) {
  assert(Number.isInteger(text_length_max) && text_length_max >= 0);

  // 0 means indefinite emphasis is allowed, which means no filtering should
  // occur at all. Technically this function should not have been called because
  // it was pointless but this should not cause an exception.
  if (text_length_max === 0) {
    return;
  }

  // Analysis is restricted to elements within body.
  if (!document.body) {
    return;
  }

  const selector = 'b, big, em, i, strong, mark, u';
  const elements = document.body.querySelectorAll(selector);
  for (const element of elements) {
    if (get_emphasis_length(element) > text_length_max) {
      unwrap_element(element);
    }
  }
}

function get_emphasis_length(element) {
  return string_filter_whitespace(element.textContent).length;
}

function string_filter_whitespace(value) {
  return value.replace(/\s+/, '');
}
