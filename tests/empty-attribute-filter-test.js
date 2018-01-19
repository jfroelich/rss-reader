import filterEmptyAttributes from "/src/feed-poll/filters/empty-attribute-filter.js";
import {parseHTML} from "/src/common/html-utils.js";

// Simple empty non-boolean attribute in body
let input = '<html><head></head><body><a name="">test</a></body></html>';
let doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><a>test</a></body></html>');

// boolean attribute with value in body
input = '<html><head></head><body><a disabled="disabled">test</a></body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><a disabled="disabled">test</a></body></html>');

// boolean attribute without value in body
input = '<html><head></head><body><a disabled="">test</a></body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><a disabled="">test</a></body></html>');

// Body element with attribute
input = '<html><head></head><body foo="">test</body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body foo="">test</body></html>');

// Multiple elements with non-boolean attributes in body
input = '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><p><a>test</a></p></body></html>');

// Multiple non-boolean attributes in element in body
input = '<html><head></head><body><a id="" name="">test</a></body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><a>test</a></body></html>');

// Element with both non-boolean and boolean attribute in body
input = '<html><head></head><body><a id="" disabled="">test</a></body></html>';
doc = parseHTML(input);
filterEmptyAttributes(doc);
console.assert(doc.documentElement.outerHTML ===
  '<html><head></head><body><a disabled="">test</a></body></html>');
