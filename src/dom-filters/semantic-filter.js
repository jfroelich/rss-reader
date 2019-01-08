import * as dfu from '/src/dom-filters/dfu.js';

// TODO: move to simple filters

// Filter semantic web elements from document content
export function semantic_filter(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      dfu.unwrap_element(element);
    }
  }
}
