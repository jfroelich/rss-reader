
import assert from "/src/utils/assert.js";
import unwrap from "/src/unwrap-element.js";

export default function unwrapDescendantsMatchingSelector(ancestorElement, selector) {
  assert(ancestorElement instanceof Element);
  assert(typeof selector === 'string');
  const elements = ancestorElement.querySelectorAll(selector);
  for(const element of elements) {
    unwrap(element);
  }
}
