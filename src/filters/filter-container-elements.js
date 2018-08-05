import {unwrap_element} from '/src/lib/dom.js';

export function filter_container_elements(document) {
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      unwrap_element(element);
    }
  }
}
