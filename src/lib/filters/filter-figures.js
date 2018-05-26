import {element_unwrap} from '/src/lib/dom/element-unwrap.js';

export function filter_figures(document) {
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      const child_count = figure.childElementCount;
      if (child_count === 1) {
        if (figure.firstElementChild.localName === 'figcaption') {
          figure.remove();
        } else {
          element_unwrap(figure);
        }
      } else if (child_count === 0) {
        element_unwrap(figure);
      }
    }
  }
}
