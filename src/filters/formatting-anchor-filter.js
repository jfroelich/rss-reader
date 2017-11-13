
import {domUnwrap} from "/src/dom.js";
import {assert} from "/src/rbl.js";

// An anchor that acts like a span can be unwrapped
// Currently misses anchors that have href attr but is empty/whitespace
export function formattingAnchorFilter(doc) {
  assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(!anchor.hasAttribute('href')) {
      domUnwrap(anchor);
    }
  }
}
