import assert from '/src/assert.js';
import {unwrap_element} from '/src/base/unwrap-element.js';

// Explores document content searching for segments of emphasized text, such as
// bold, italicized, or underlined text. If a segment is found that is longer
// than the specified threshold, then the segment is de-emphasized (the emphasis
// element is removed but its descendant nodes remain).
//
// Currently, this ignores CSS rules due to the cost of computing styles. A
// future implementation may consider computed style.
//
// A substantial amount of content on the Internet is written poorly. Many
// authors get carried away with underlining everything. Sometimes emphasis is
// used for other purposes than conventional use, such as simple visual style.
//
// @param document {Document} the document to analyze
// @param text_length_max {Number} an optional integer representing a threshold
// of text length above which a segment of emphasized text is considered too
// long. Note that when calculating the length of some emphasized text for
// comparison against this threshold, only the non-whitespace length is used.
// @error {Error} if document is not a Document
// @error {Error} if the text length parameter is not a positive integer
export function emphasis_filter(document, text_length_max = 0) {
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
