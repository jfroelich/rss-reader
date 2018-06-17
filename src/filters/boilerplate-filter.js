import * as boilerplate from '/src/filters/boilerplate.js';

// The boilerplate filter classifies elements as boilerplate and then prunes
// boilerplate from the document.

export function filter_boilerplate(document) {
  boilerplate.annotate(document);
  const best_element = document.querySelector('[data-bp-max]');
  if (!best_element) {
    return;
  }

  const doc_element = document.documentElement;
  if (best_element === doc_element || best_element === document.body) {
    return;
  }

  const elements = document.body.querySelectorAll('*');
  for (const element of elements) {
    if (element.contains(best_element)) {
      continue;
    }

    if (best_element.contains(element)) {
      continue;
    }

    if (!doc_element.contains(element)) {
      continue;
    }

    element.remove();
  }
}
