import {html_parse} from '/src/html-utils.js';
import filter, {element_coerce} from '/src/content-filter/condense-tagnames-filter.js';

let input = '<html><head></head><body><a></a></body></html>';
const doc = html_parse(input);

let anchors = doc.querySelectorAll('a');
for (let a of anchors) {
  element_coerce(a, 'b', true);
}
console.assert(
    doc.documentElement.outerHTML ===
    '<html><head></head><body><b></b></body></html>');
let bs = doc.querySelectorAll('b');
for (let b of bs) {
  element_coerce(b, 'c', true);
}
console.assert(
    doc.documentElement.outerHTML ===
    '<html><head></head><body><c></c></body></html>');

console.log(
    'If no assertion error messages appear before this message then all tests passed');
