import assert from '/src/assert.js';
import {filter_unprintables} from '/src/base/filter-unprintables.js';

export async function filter_unprintables_test() {
  const f = filter_unprintables;

  for (let i = 0; i < 9; i++) {
    assert(f(String.fromCharCode(i)).length === 0);
  }

  assert(f('\t').length === 1);  // 9
  assert(f('\n').length === 1);  // 10
  assert(f(String.fromCharCode(11)).length === 0);
  assert(f('\f').length === 1);  // 12
  assert(f('\r').length === 1);  // 13

  const space_code = ' '.charCodeAt(0);
  for (let i = 14; i < space_code; i++) {
    assert(f(String.fromCharCode(i)).length === 0);
  }

  assert(f(' ').length === 1);
  assert(f('Hello').length === 5);
  assert(f('World').length === 5);
  assert(f('Hello\nWorld').length === 11);
  assert(f('Hello\u0000World').length === 10);
  assert(f('<tag>text</t\u0005ag>').length === 15);

  assert(f('').length === 0);
  assert(f(null) === null);
  assert(f(void 0) === void 0);
  assert(f(true) === true);
  assert(f(false) === false);
  assert(isNaN(f(NaN)));
  assert(f(0) === 0);
}
