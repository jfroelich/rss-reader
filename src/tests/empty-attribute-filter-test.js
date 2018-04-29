import {document_filter_empty_attributes} from '/src/content-filters/content-filters.js';
import {parse as parse_html} from '/src/lib/html-parser.js';
import {assert} from '/src/tests/assert.js';

export async function empty_attribute_filter_test() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = parse_html(input);
  document_filter_empty_attributes(doc);
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Body element with attribute
  input = '<html><head></head><body foo="">test</body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output = '<html><head></head><body foo="">test</body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input =
      '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input =
      '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  console.debug('%s: input', empty_attribute_filter_test.name, input);
  doc = parse_html(input);
  document_filter_empty_attributes(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}