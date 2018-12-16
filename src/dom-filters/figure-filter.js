import {unwrap_element} from '/src/base/unwrap-element.js';

export function figure_filter(document) {
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      const child_count = figure.childElementCount;
      if (child_count === 1) {
        if (figure.firstElementChild.localName === 'figcaption') {
          figure.remove();
        } else {
          unwrap_element(figure);
        }
      } else if (child_count === 0) {
        unwrap_element(figure);
      }
    }
  }
}
