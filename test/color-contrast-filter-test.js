// import assert from '/lib/assert.js';
// import colorContrastFilter from '/lib/dom-filters/color-contrast-filter.js';
import parseHTML from '/lib/parse-html.js';

export function colorContrastFilterTest() {
  // TODO: implement
}

export function colorParseTypedCSSTest() {
  // TODO: expiriment with typed CSS OM
  // TODO: investigate element.computedStyleMap(), looks like it still does
  // not work with non-attached

  const input = '<div style="background-color: #ffffff;">white</div>';
  const doc = parseHTML(input);
  const element = doc.querySelector('div');
  console.debug(element.style.backgroundColor);
  console.debug(element.attributeStyleMap.get('background-color'));

  const map = element.computedStyleMap();
  console.dir(map);
  console.debug(map.get('background-color'));
}
