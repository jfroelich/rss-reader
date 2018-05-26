import {element_unwrap} from '/src/lib/dom/element-unwrap.js';

// TODO: this is over-specialization. This should be using some generic
// unwrap-elements-matching-selector helper. Right now this is akin to creating
// a class for every instance. That isn't the right way to go.

// Filter semantic web elements from document content
export function filter_semantic_elements(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}
