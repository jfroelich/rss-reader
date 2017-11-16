
import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";

// An anchor that acts like a span can be unwrapped. Currently misses anchors that have href attr
// but is empty/whitespace
export function formattingAnchorFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(!anchor.hasAttribute('href')) {
      unwrap(anchor);
    }
  }
}
