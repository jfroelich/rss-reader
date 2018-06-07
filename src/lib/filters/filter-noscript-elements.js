import {unwrap_element} from '/src/lib/dom/unwrap-element.js';

// Transforms noscript elements
export function filter_noscript_elements(document) {
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      unwrap_element(noscript);
    }
  }
}
