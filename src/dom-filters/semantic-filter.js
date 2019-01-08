import * as dfutils from '/src/dom-filters/dfutils.js';

// TODO: move to simple filters

// Filter semantic web elements from document content
export function semantic_filter(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      dfutils.unwrap_element(element);
    }
  }
}
