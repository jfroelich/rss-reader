import assert from '/src/common/assert.js';
import {unwrapElement} from '/src/feed-poll/filters/content-filter-utils.js';

// Filter semantic web elements from document content
export default function filterDocument(document) {
  assert(document instanceof Document);
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      unwrapElement(element);
    }
  }
}
