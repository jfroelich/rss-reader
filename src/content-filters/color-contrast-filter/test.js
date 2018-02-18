import {color_format, COLOR_WHITE} from '/src/color/color.js';
import * as ccf from '/src/content-filters/color-contrast-filter/color-contrast-filter.js';

// TODO: semi-automated tests that compare output to expected output

// expose to console under a prefix to play with stuff directly
window.ccf = ccf;
window.color_format = color_format;
window.COLOR_WHITE = COLOR_WHITE;

window.test1 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const matte = COLOR_WHITE;
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
  const matte = COLOR_WHITE;

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      const back_color =
          ccf.element_derive_background_color(node.parentNode, matte);
      console.debug(value, color_format(back_color));
    }

    node = it.nextNode();
  }
};
