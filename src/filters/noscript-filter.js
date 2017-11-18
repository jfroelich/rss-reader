// Transforms noscript content in document content

import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap(noscript);
  }
}
