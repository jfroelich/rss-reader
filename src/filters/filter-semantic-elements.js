import {unwrap_element} from '/src/lib/dom.js';

// Filter semantic web elements from document content
export function filter_semantic_elements(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      unwrap_element(element);
    }
  }
}
