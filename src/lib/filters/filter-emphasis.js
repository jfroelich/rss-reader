import {element_unwrap} from '/src/lib/element-unwrap.js';

// TODO: deprecate assert helper for now
// TODO: maybe remove the assertion all together as it is too paranoid

// TODO: rather than generate strings and involve multiple function calls, it
// might be better to use a get_character_count function approach

export function filter_emphasis(document, text_length_max) {
  assert(Number.isInteger(text_length_max) && text_length_max > 0);
  if (document.body) {
    const elements = document.body.querySelectorAll('b, big, em, i, strong');
    for (const element of elements) {
      if (get_emphasis_length(element) > text_length_max) {
        element_unwrap(element);
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

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
