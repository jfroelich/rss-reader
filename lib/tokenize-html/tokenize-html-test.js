
document.addEventListener('DOMContentLoaded', function(event) {

  let input;
  let tokens;

  // TODO: Test: zero length string input


  // Test: undefined input
  input = undefined;
  console.log('TEST:', '(undefined)');
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing undefined input did not throw an exception');
  } catch(error) {
    // console.debug(error);
  }

  // Test: null input
  input = null;
  console.log('TEST:', '(null)');
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing null input did not throw an exception');
  } catch(error) {
    // console.debug(error);
  }

  // Test: numerical input
  input = 123;
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing numerical input did not throw an exception');
  } catch(error) {
    // console.debug(error);
  }

  // Test: boolean input
  input = true;
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing boolean input did not throw an exception');
  } catch(error) {
    // console.debug(error);
  }

  // Test: Date object input
  input = new Date();
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing Date object input did not throw an exception');
  } catch(error) {
  }

  // Test: basic object input
  input = {'foo': 'bar', 'length': 123};
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing basic object input did not throw an exception');
  } catch(error) {
  }

  // Test: array of strings input
  input = ['a', 'b', 'c'];
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing string array input did not throw an exception');
  } catch(error) {
  }

  // Test: zero length string
  input = '';
  console.log('TEST:', '(zero length string)');
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 0, 'zero length string input');

  // Test: string of spaces
  input = '   ';
  console.log('TEST:', '(string of 3 spaces)');
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: string with some other whitespace
  input = ' \n \t \r\n  ';
  console.log('TEST:', '(string with various whitespace)');
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: single <
  input = '<';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing < did not throw an exception');
  } catch(error) {
    // console.debug(error);
  }

  // Test: single >
  input = '>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);;
  console.assert(tokens.length === 1 && tokens[0] === input, input);


  // Test: basic text input
  input = 'All Text Input 0123456789';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: text with floating > input
  input = 'a > b';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: single starting tag
  input = '<p>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens[0] === '<p>', input);

  // Test: single ending tag
  input = '</p>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens[0] === '</p>', input);

  // TODO: test text before single tag
  // TODO: test text after single tag

  // Test: basic open and close tag
  input = '<p>a</p>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 3 && tokens[0] === '<p>' &&
    tokens[1] === 'a' && tokens[2] === '</p>', input);


  // Test: tag name with whitespace in body
  input = '<p  >a';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === '<p  >' &&
    tokens[1] === 'a', input);

  // Test: tag body containing tag
  input = '<p<a>>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === '<p<a>' &&
    tokens[1] === '>', input);


  // TODO: test tag attributes

  // Test: tag name with attribute name
  input = '<p style>';
  // Test: tag name with attribute name and unquoted value
  // Test: tag name with single quoted attribute
  // Test: tag name with double quoted attribute
  // Test: tag name with single quoted attribute with nested >

  // TODO: test comments

  // Test: basic comment
  // Test: empty comment
  // Test: comment containing -
  // Test: comment containing --
  // Test: comment containing html tags
  // Test: comment containing \n
  // Test:



  // TODO: test script
  // TODO: test style
  // TODO: test processing instruction

  // TODO: malformed variations of every case


  // TODO: test floating " character in text (decoded)



  // TEST: test > encountered in text state
  // TODO: test --> encountered in text state
});
