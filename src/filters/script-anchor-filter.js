// Unwraps anchor elements containing href attribute values that are javascript

import assert from "/src/utils/assert.js";
import {unwrap} from "/src/utils/dom.js";
import {hasScriptProtocol} from "/src/url-string.js";

export default function filter(doc) {
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
