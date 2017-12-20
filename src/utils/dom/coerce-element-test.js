import coerceElement from "/src/utils/dom/coerce-element.js";
import parseHTML from "/src/utils/html/parse.js";

let input = '<html><head></head><body><a></a></body></html>';
let doc = parseHTML(input);
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
