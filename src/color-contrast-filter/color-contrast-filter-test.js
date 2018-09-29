import assert from '/src/assert/assert.js';
import * as ccf from '/src/color-contrast-filter/color-contrast-filter.js';
import * as css_color from '/src/color-contrast-filter/css-color.js';
import * as color from '/src/color/color.js';
import * as ls from '/src/localstorage/localstorage.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: these tests were written to work off a live document. Instead, create
// a local fake document, and test against it

async function color_contrast_filter_test1() {
  /*
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const matte = color.WHITE;
  const threshold = ls.read_float('min_contrast_ratio');

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
  }*/
}

async function color_contrast_filter_test2() {
  /*
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
*/
};

register_test(color_contrast_filter_test1);
register_test(color_contrast_filter_test2);
