
import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";
import {isPosInt} from "/src/number.js";

// @param maxTextLength {Number} optional, if number of non-tag characters
// within emphasis element is greater than this, then the element is filtered
export function emphasisFilter(doc, maxTextLength) {
  assert(doc instanceof Document);

  if(typeof maxTextLength === 'undefined') {
    maxTextLength = 0;
  }
  assert(isPosInt(maxTextLength));
  if(!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll('b, big, em, i, strong');
  for(const element of elements) {
    if(element.textContent.length > maxTextLength) {
      unwrap(element);
    }
  }
}
