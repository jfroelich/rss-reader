
import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";
import {hasScriptProtocol} from "/src/url-string.js";

export function scriptAnchorFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(hasScriptProtocol(anchor.getAttribute('href'))) {
      unwrap(anchor);
    }
  }
}
