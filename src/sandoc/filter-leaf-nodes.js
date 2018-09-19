import {is_leaf_node} from '/src/sandoc/node-is-leaf.js';

export function filter_leaf_nodes(document) {
  if (document.body) {
    const root = document.documentElement;
    const elements = document.body.querySelectorAll('*');
    for (const element of elements) {
      if (root.contains(element) && is_leaf_node(element)) {
        element.remove();
      }
    }
  }
}
