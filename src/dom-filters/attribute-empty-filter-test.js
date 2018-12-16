import assert from '/src/assert.js';
import {parse_html} from '/src/html-utils/parse-html.js';
import {attribute_empty_filter} from './attribute-empty-fiter.js';

export async function attribute_empty_filter_test() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = parse_html(input);
  attribute_empty_filter(doc);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Body element with attribute
  input = '<html><head></head><body foo="">test</body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body foo="">test</body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input =
      '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input =
      '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  doc = parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}
