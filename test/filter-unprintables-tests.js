import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import filterUnprintables from '/lib/filter-unprintables.js';

function filterUnprintablesTest() {
  for (let i = 0; i < 9; i += 1) {
    assert(filterUnprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filterUnprintables('\t').length === 1); // 9
  assert(filterUnprintables('\n').length === 1); // 10
  assert(filterUnprintables(String.fromCharCode(11)).length === 0);
  assert(filterUnprintables('\f').length === 1); // 12
  assert(filterUnprintables('\r').length === 1); // 13

  const spaceCode = ' '.charCodeAt(0);
  for (let i = 14; i < spaceCode; i += 1) {
    assert(filterUnprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filterUnprintables(' ').length === 1);
  assert(filterUnprintables('Hello').length === 5);
  assert(filterUnprintables('World').length === 5);
  assert(filterUnprintables('Hello\nWorld').length === 11);
  assert(filterUnprintables('Hello\u0000World').length === 10);
  assert(filterUnprintables('<tag>text</t\u0005ag>').length === 15);
}

TestRegistry.registerTest(filterUnprintablesTest);
