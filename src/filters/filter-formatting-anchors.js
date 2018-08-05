import {unwrap_element} from '/src/lib/dom.js';

export function filter_formatting_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        unwrap_element(anchor);
      }
    }
  }
}
