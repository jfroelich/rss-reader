// import assert from '/src/lib/assert.js';
// import colorContrastFilter from '/src/lib/dom-filters/color-contrast.js';
import TestRegistry from '/src/test/test-registry.js';
import parseHTML from '/src/lib/parse-html.js';

// function colorContrastFilterTest() {
// TODO: implement (and register in test registry once implemented)
// }

function colorParseTypedCSSTest() {
  // TODO: expiriment with typed CSS OM
  // TODO: investigate element.computedStyleMap(), looks like it still does not work with
  // non-attached
  // TODO: actually assert things of course

  const input = '<div style="background-color: #ffffff;">white</div>';
  const doc = parseHTML(input);
  const element = doc.querySelector('div');
  console.debug(element.style.backgroundColor);
  console.debug(element.attributeStyleMap.get('background-color'));

  const map = element.computedStyleMap();
  console.dir(map);
  console.debug(map.get('background-color'));
}

TestRegistry.registerTest(colorParseTypedCSSTest);
