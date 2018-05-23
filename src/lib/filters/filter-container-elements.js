import {element_unwrap} from '/src/lib/element-unwrap.js';

export function filter_container_elements(document) {
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}
