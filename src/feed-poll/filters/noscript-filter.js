import assert from '/src/common/assert.js';
import {unwrapElement} from '/src/feed-poll/filters/content-filter-utils.js';

// TODO: move to basic filters

// Transforms noscript content in document content
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const noscripts = doc.body.querySelectorAll('noscript');
  for (const noscript of noscripts) {
    unwrapElement(noscript);
  }
}
