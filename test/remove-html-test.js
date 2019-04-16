import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import removeHTML from '/lib/remove-html.js';

// TODO: Text with an entity that is not kept
// TODO: test malformed html that causes error
// TODO: test text outside of body
// TODO: whitespace normalization

function removeHTMLTest() {
  // No html tags or entities undergoes no change
  let input = 'some text without html';
  let output = removeHTML(input);
  assert(input === output);

  // One html tag, no entities, tag is removed
  input = '<p>paragraph</p>';
  output = removeHTML(input);
  assert(output === 'paragraph');

  // A couple html tags, no entities
  input = '<p><b>bold</b> afterspace</p>';
  output = removeHTML(input);
  assert(output === 'bold afterspace');

  // Text with an entity that is lost by transformation. &#32; represents a
  // space.
  input = 'before&#32;after';
  output = removeHTML(input);
  assert(output === 'before after');

  // Text with an entity that is lost by transformation
  input = 'before&copy;after';
  output = removeHTML(input);
  assert(output === 'before©after');
}

TestRegistry.registerTest(removeHTMLTest);
