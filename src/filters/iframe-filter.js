// Filters iframe elements from document content

import assert from "/src/assert.js";

export default function iframeFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const iframes = doc.body.querySelectorAll('iframe');
  for(const iframe of iframes) {
    iframe.remove();
  }
}
