import filter, {coerceElement} from "/src/feed-poll/filters/condense-tagnames-filter.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";

let input = '<html><head></head><body><a></a></body></html>';
const doc = parseHTML(input);

let anchors = doc.querySelectorAll('a');
for(let a of anchors) {
  coerceElement(a, 'b', true);
}
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><b></b></body></html>');
let bs = doc.querySelectorAll('b');
for(let b of bs) {
  coerceElement(b, 'c', true);
}
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><c></c></body></html>');

console.log('If no assertion error messages appear before this message then all tests passed');
