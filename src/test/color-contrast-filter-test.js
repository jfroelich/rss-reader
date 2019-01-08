import assert from '/src/assert.js';
import * as color from '/src/color.js';
import * as ccf from '/src/dom-filters/color-contrast-filter.js';

// TODO: these tests were written to work off a live document. Instead, create
// a local fake document, and test against it
// TODO: overhaul these tests. I have done a quick disable for now, but given
// how everything has changed, these need to be completely redone

export async function color_contrast_filter_test1() {
  /*
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);

  const matte = color.WHITE;
  const threshold = 1.2;

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

export async function color_contrast_filter_test2() {
  /*
  const matte = color.WHITE;

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const value = node.nodeValue.trim();
    if (value) {
      const back_color =
          ccf.element_derive_background_color(node.parentNode, matte);
      console.debug(value, ccf.css_color_format(back_color));
    }

    node = it.nextNode();
  }
*/
}
