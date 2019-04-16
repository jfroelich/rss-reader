import assert from '/src/lib/assert.js';
import unwrapElement from '/src/lib/unwrap-element.js';

// Removes the emphasis from emphasized content that contains too many characters. Emphasis should
// be used to differentiate a small piece of content from the rest of the content. When there is too
// much text the emphasis becomes stylistic, the value the emphasis provides is reduced, and the
// text becomes difficult to read. This filter's goal is to increase readability.
//
// The threshold parameter represents the minimum number of characters (exclusive) of text before
// the text is considered over-emphasized. Note that whitespace is condensed before comparing text
// length against the threshold. The parameter defaults to a reasonably big number. In practice this
// parameter should have a value between 200 and 1000.
export default function filter(document, threshold = 500) {
  assert(typeof threshold === 'number');
  assert(Number.isInteger(threshold));
  assert(threshold > 0);

  // Secretly fix redundant nesting and multimodal emphasis
  // TODO: revisit whether this belongs here or in some other filter
  const nestedSelector = 'strong strong, strong b, b strong, b b, u u, u em, em u, em em';
  const redundantChildElements = document.querySelectorAll(nestedSelector);
  for (const element of redundantChildElements) {
    unwrapElement(element);
  }

  const emphasizedSelector = 'b, big, em, i, strong, mark, u';
  const emphasizedElements = document.querySelectorAll(emphasizedSelector);
  for (const element of emphasizedElements) {
    const adjustedTextContent = element.textContent.replace(/\s+/, '');
    if (adjustedTextContent.length > threshold) {
      unwrapElement(element);
    }
  }
}
