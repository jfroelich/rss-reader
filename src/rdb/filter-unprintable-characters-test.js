import {string_filter_unprintable_characters} from '/src/rdb/rdb.js';

const d = console.debug;
const f = string_filter_unprintable_characters;

// Given string, filter it, then assert whether the filtered string length is
// equal to the given length, and print the result to the console.
const a = function(s, len) {
  const result = string_filter_unprintable_characters(s);
  const passed = result.length === len;
  d('input', escape(s), 'length', len, passed ? 'passed' : 'failed');
};

function run() {
  console.group('Testing [0 .. 31]');

  for (let i = 0; i < 9; i++) {
    a(String.fromCharCode(i), 0);
  }

  a('\t', 1);  // 9
  a('\n', 1);  // 10
  a(String.fromCharCode(11), 0);
  a('\f', 1);  // 12
  a('\r', 1);  // 13

  const spaceCode = ' '.charCodeAt(0);

  for (let i = 14; i < spaceCode; i++) {
    a(String.fromCharCode(i), 0);
  }

  console.groupEnd();

  console.group('Testing [32 .. n)');
  a(' ', 1);
  a('Hello', 5);
  a('World', 5);
  a('Hello\nWorld', 11);
  a('Hello\u0000World', 10);
  a('<tag>text</t\u0005ag>', 15);
  console.groupEnd();

  console.group('Testing type');
  a('', 0);
  d('input', null, 'length', NaN, f(null) === null ? 'passed' : 'failed');
  d('input', void 0, 'length', NaN, f(void 0) === void 0 ? 'passed' : 'failed');
  d('input', true, 'length', NaN, f(true) === true ? 'passed' : 'failed');
  d('input', false, 'length', NaN, f(false) === false ? 'passed' : 'failed');
  d('input', NaN, 'length', NaN, isNaN(f(NaN)) ? 'passed' : 'failed');
  d('input', 0, 'length', NaN, f(0) === 0 ? 'passed' : 'failed');
  console.groupEnd();
}

// Run test on module load
run();

window.string_filter_unprintable_characters = string_filter_unprintable_characters;
