import {element_unwrap} from '/src/lib/element-unwrap.js';

export function filter_formatting_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        element_unwrap(anchor);
      }
    }
  }
}
