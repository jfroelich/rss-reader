import * as boilerplate from '/src/lib/filters/boilerplate.js';

// The boilerplate filter classifies elements as boilerplate and then prunes
// boilerplate from the document.
// TODO: is it better to have annotate return the best element, or to find it
// again here? Returning best element avoids need for querySelector call but it
// also locks in the boilerplate API (reduces flexibility).
// TODO: optimize pruning to use fewer calls to contains, use the special node
// function that checks for relation between two nodes
// TODO: maybe annotate should add a disconnected attribute during annotation
// and then scoring doesn't need to do any special tests per element, it could
// just find and remove all disconnected elements using querySelectorAll

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
