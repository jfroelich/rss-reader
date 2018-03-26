import * as color from '/src/lib/color/color.js';
import * as ccf from '/src/content-filters/color-contrast-filter/color-contrast-filter.js';
import * as css_color from '/src/lib/css-color/css-color.js';

window.ccf = ccf;
window.color = color;
window.css_color = css_color;

window.test1 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const matte = color.WHITE;
  const threshold = localStorage.MIN_CONTRAST_RATIO;

  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      console.debug(
          value,
          ccf.element_is_perceptible(node.parentNode, matte, threshold) ?
              'yes' :
              'no');
    }

    node = it.nextNode();
  }
};

window.test2 = function() {
  const matte = color.WHITE;

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      const back_color =
          ccf.element_derive_background_color(node.parentNode, matte);
      console.debug(value, css_color.format(back_color));
    }

    node = it.nextNode();
  }
};
