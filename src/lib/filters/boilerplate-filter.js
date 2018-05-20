import * as boilerplate from '/src/lib/boilerplate.js';

export function filter_boilerplate(document, console) {
  boilerplate.annotate(document, console);
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
