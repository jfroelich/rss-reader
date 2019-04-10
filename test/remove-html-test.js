import assert from '/lib/assert.js';
import remove_html from '/lib/remove-html.js';

export function remove_html_test() {
  // No html tags or entities undergoes no change
  let input = 'some text without html';
  let output = remove_html(input);
  assert(input === output);

  // One html tag, no entities, tag is removed
  input = '<p>paragraph</p>';
  output = remove_html(input);
  assert(output === 'paragraph');

  // A couple html tags, no entities
  input = '<p><b>bold</b> afterspace</p>';
  output = remove_html(input);
  assert(output === 'bold afterspace');

  // Text with an entity that is lost by transformation. &#32; represents a
  // space.
  input = 'before&#32;after';
  output = remove_html(input);
  assert(output === 'before after');

  // Text with an entity that is lost by transformation
  input = 'before&copy;after';
  output = remove_html(input);
  assert(output === 'before©after');

  // TODO: Text with an entity that is not kept

  // TODO: test malformed html that causes error
  // TODO: test text outside of body
  // TODO: whitespace normalization
}
