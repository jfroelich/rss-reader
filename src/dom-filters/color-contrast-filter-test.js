import {assert} from '/src/assert.js';
import {color_contrast_filter} from '/src/dom-filters/color-contrast-filter.js';
import {parse_html} from '/src/parse-html.js';

export async function color_contrast_filter_test() {
  // TODO: implement
}

export async function color_parse_typed_css_test() {
  // TODO: expiriment with typed CSS OM
  // TODO: investigate element.computedStyleMap(), looks like it still does
  // not work with non-attached

  let input = '<div style="background-color: #ffffff;">white</div>';
  let doc = parse_html(input);
  let element = doc.querySelector('div');
  console.debug(element.style.backgroundColor);
  console.debug(element.attributeStyleMap.get('background-color'));

  let map = element.computedStyleMap();
  console.dir(map);
  console.debug(map.get('background-color'));
}
