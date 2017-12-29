import formatString from "/src/common/format-string.js";

// Enable direct calling in console
window.formatString = formatString;

// Aliases for convenience
const a = console.assert;
const s = formatString;

// No format tests
a(s() === '');
a(s(undefined) === 'undefined');
a(s(null) === 'null');
a(s('a') === 'a');
a(s(1) === '1');
a(s(1, 2) === '1 2');
// NOTE: formatString api departs from console.log, as expected
a(s(new URL('http://a.b.c')) === 'http://a.b.c/');
a(s({}) === '{}');
a(s({}, {}) === '{} {}');

a(s(new Date("Sat Jan 01 2000 00:00:00 GMT-0500 (EST)")) ===
  'Sat Jan 01 2000 00:00:00 GMT-0500 (EST)');


// Format with no formatting
a(s('a', 1) === 'a 1');
a(s('b', {}, {}) === 'b {} {}');
a(s('c d', 3) === 'c d 3');

// Format with no other args
a(s('%%') === '%%');
a(s('%o') === '%o');

// Format not first arg (depart from console.log behavior?)
a(s(3, 'a') === '3 a');
a(s(4, 'a %d') === '4 a %d');

// Literal percent
a(s('%%', 'hello') === '% hello');
a(s('%%', 1) == '% 1');

// Number tests
a(s(0) === '0');
a(s(-0) === '-0');
a(s(Number.POSITIVE_INFINITY) === 'Infinity');
a(s(Number.NEGATIVE_INFINITY) === '-Infinity');
a(s('%d', 1) === '1');
a(s(' %d ', 2) === ' 2 ');
a(s('%d', 3.14) === '3.14');
a(s('%d%d', 1, 2) === '12');
a(s('%dd', 1, 2) === '1d 2');
a(s('%d', 'hello') === 'NaN');
a(s('%d', new Date()) === 'NaN');
a(s('%d', {}) === 'NaN');
a(s('%d', []) === 'NaN');
a(s('%d', '') === 'NaN');
a(s('%d', function(){}) === 'NaN');

// Function tests
// The space before () for anon func is added by native toString
a(s(function(){}) === 'function (){}');
a(s(function (){}) === 'function (){}');
a(s(function foo(){}) === 'function foo(){}');
a(s('%d', function(){}) === 'NaN');
a(s('%s', function(){}) === 'function (){}');
a(s('%o', function(){}) === 'function (){}');

// Object tests
a(s({}) === '{}');
a(s('%o') === '%o');
a(s('%o', {}) === '{}');
a(s('%o', []) === '[]');
a(s('%o', {a:1}) === '{"a":1}');
a(s('%o', 1) === '1');
a(s('%o', 'hello') === 'hello');
a(s('%o', new Date("Sat Jan 01 2000 00:00:00 GMT-0500 (EST)")) ===
  'Sat Jan 01 2000 00:00:00 GMT-0500 (EST)');
function Bar() { this.hello = 'world'; }
const barInstance = new Bar();
a(s('%o', barInstance) === '{"hello":"world"}');


// TODO: Mismatch between % flag things and argument counts test
// TODO: test bad json object with cycle or whatever

console.log('if all tests passed, nothing before this message appears in console');
