import assert from '/lib/assert.js';
import filterUnprintables from '/lib/filter-unprintables.js';

export function filter_unprintables_test() {
  for (let i = 0; i < 9; i++) {
    assert(filterUnprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filterUnprintables('\t').length === 1); // 9
  assert(filterUnprintables('\n').length === 1); // 10
  assert(filterUnprintables(String.fromCharCode(11)).length === 0);
  assert(filterUnprintables('\f').length === 1); // 12
  assert(filterUnprintables('\r').length === 1); // 13

  const space_code = ' '.charCodeAt(0);
  for (let i = 14; i < space_code; i++) {
    assert(filterUnprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filterUnprintables(' ').length === 1);
  assert(filterUnprintables('Hello').length === 5);
  assert(filterUnprintables('World').length === 5);
  assert(filterUnprintables('Hello\nWorld').length === 11);
  assert(filterUnprintables('Hello\u0000World').length === 10);
  assert(filterUnprintables('<tag>text</t\u0005ag>').length === 15);
}
