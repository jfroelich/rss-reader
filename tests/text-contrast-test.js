import {rgba_to_string} from '/src/content-filters/blender.js';
import {element_derive_background_color, text_node_is_color_perceptible} from '/src/content-filters/text-contrast.js';

window.test1 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const min_contrast_ratio = localStorage.MIN_CONTRAST_RATIO || 1.2;
  console.debug('Using minimum contrast ratio', min_contrast_ratio);

  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      console.debug(
          value,
          text_node_is_color_perceptible(node, min_contrast_ratio) !== false ?
              'yes' :
              'no');
    }

    node = it.nextNode();
  }
};

window.test2 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      const bgtc = element_derive_background_color(node.parentNode);
      const rgba = bgtc.toRgb();
      console.debug(value, rgba_to_string(rgba));
    }

    node = it.nextNode();
  }
};
