import {unwrap_element} from '/src/dom.js';

// Removes noscript elements
export function filter_noscript_elements(document) {
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      noscript.remove();
    }
  }
}
