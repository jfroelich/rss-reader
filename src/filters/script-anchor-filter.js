
import assert from "/src/assert.js";
import {domUnwrap} from "/src/dom.js";
import {hasScriptProtocol} from "/src/url.js";

export function scriptAnchorFilter(doc) {
  assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(hasScriptProtocol(anchor.getAttribute('href'))) {
      domUnwrap(anchor);
    }
  }
}
