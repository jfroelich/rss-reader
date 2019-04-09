import assert from '/src/assert.js';
import filter_unprintables from '/src/db/filter-unprintables.js';

export function filter_unprintables_test() {
  for (let i = 0; i < 9; i++) {
    assert(filter_unprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filter_unprintables('\t').length === 1);  // 9
  assert(filter_unprintables('\n').length === 1);  // 10
  assert(filter_unprintables(String.fromCharCode(11)).length === 0);
  assert(filter_unprintables('\f').length === 1);  // 12
  assert(filter_unprintables('\r').length === 1);  // 13

  const space_code = ' '.charCodeAt(0);
  for (let i = 14; i < space_code; i++) {
    assert(filter_unprintables(String.fromCharCode(i)).length === 0);
  }

  assert(filter_unprintables(' ').length === 1);
  assert(filter_unprintables('Hello').length === 5);
  assert(filter_unprintables('World').length === 5);
  assert(filter_unprintables('Hello\nWorld').length === 11);
  assert(filter_unprintables('Hello\u0000World').length === 10);
  assert(filter_unprintables('<tag>text</t\u0005ag>').length === 15);
}
