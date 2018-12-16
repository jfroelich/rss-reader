import {unwrap_element} from '/src/base/unwrap-element.js';

// Removes container-like elements from the document
export function container_filter(document) {
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      unwrap_element(element);
    }
  }
}
