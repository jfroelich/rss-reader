import {text_node_is_color_perceptible} from '/experimental/text-node-is-color-perceptible.js';

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
