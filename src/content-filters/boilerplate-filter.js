import * as boilerplate from '/src/boilerplate/boilerplate.js';

export function filter_boilerplate(document) {
  // Score the data
  boilerplate.annotate(document);

  // Search for the best element
  const best_element = document.querySelector('[data-bp-max]');

  // If we did not find a best element then do nothing
  if (!best_element) {
    return;
  }

  // If the best element is a content wrapper then do nothing
  const doc_element = document.documentElement;
  if (best_element === doc_element || best_element === document.body) {
    return;
  }

  // Prune elements not connected to the best element
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
