import assert from '/src/base/assert.js';
import {unwrap_element} from '/src/base/unwrap-element.js';

export function filter_emphasis(document, text_length_max) {
  assert(Number.isInteger(text_length_max) && text_length_max > 0);
  if (document.body) {
    const elements =
        document.body.querySelectorAll('b, big, em, i, strong, mark, u');
    for (const element of elements) {
      if (get_emphasis_length(element) > text_length_max) {
        unwrap_element(element);
      }
    }
  }
}

function get_emphasis_length(element) {
  return string_filter_whitespace(element.textContent).length;
}

function string_filter_whitespace(value) {
  return value.replace(/\s+/, '');
}
