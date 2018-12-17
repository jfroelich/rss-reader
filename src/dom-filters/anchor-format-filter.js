import {unwrap_element} from '/src/dom-utils/unwrap-element.js';

export function anchor_format_filter(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        unwrap_element(anchor);
      }
    }
  }
}
