import * as ccf from '/src/content-filters/color-contrast-filter/color-contrast-filter.js';

// TODO: semi-automated tests that compare output to expected output

// expose to console under a prefix to play with stuff directly
window.ccf = ccf;

window.test1 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const min_contrast_ratio = localStorage.MIN_CONTRAST_RATIO || 1.2;
  console.debug('Using minimum contrast ratio', min_contrast_ratio);

  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      console.debug(
          value,
          ccf.element_is_perceptible(node.parentNode, min_contrast_ratio) ?
              'yes' :
              'no');
    }

    node = it.nextNode();
  }
};

window.test2 = function() {
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      const color = ccf.element_derive_background_color(node.parentNode);
      console.debug(value, ccf.color_to_css(color));
    }

    node = it.nextNode();
  }
};
