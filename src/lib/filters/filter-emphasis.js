import {unwrap_element} from '/src/lib/dom/unwrap-element.js';

// TODO: deprecate assert helper for now
// TODO: maybe remove the assertion all together as it is too paranoid

// TODO: rather than generate strings and involve multiple function calls, it
// might be better to use a get_character_count function approach

// TODO: change max length input to be max length per emphasis type, have
// separate maxes for bold, italics. then also add a new max length for block
// quotes and also limit the size of block quotes (e.g. when it is almost the
// entire page that  is too much).
// TODO: consider looking at css of all tags and not just tag name
// TODO: i should possibly have this consult style attribute instead of just
// element type (e.g. look at font-weight)

export function filter_emphasis(document, text_length_max) {
  assert(Number.isInteger(text_length_max) && text_length_max > 0);
  if (document.body) {
    const elements = document.body.querySelectorAll('b, big, em, i, strong');
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

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
