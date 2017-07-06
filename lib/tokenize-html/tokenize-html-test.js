
document.addEventListener('DOMContentLoaded', function(event) {

  let input;
  let tokens;


  /////////////////////////////////////////////////////////
  // Test abnormal inputs

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

  // Test: single > floating in text
  input = ' > ';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);;
  console.assert(tokens.length === 1 && tokens[0] === input, input);


  //////////////////////////////////////////////////////
  // Test basic inputs

  // Test: text
  input = 'All Text Input 0123456789';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: text with floating > input
  input = 'a > b';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test single quote in text
  input = 'a\'b';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);


  // Test double quote in text
  input = 'a"b';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);


  // Test: single starting tag
  input = '<p>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: single ending tag
  input = '</p>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: closed tag
  input = '<br/>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: text before single tag
  input = 'a</b>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === 'a' &&
    tokens[1] === '</b>', input);

  // Test: text after single tag
  input = '</b>a';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === '</b>' &&
    tokens[1] === 'a', input);

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

  ///////////////////////////////////////////////////////////////////
  // Tag attribute tests

  // Test: tag body with attribute name
  input = '<p style>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag body with single quoted attribute value
  input = '<a b=\'c\'>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag body with double quoted attribute value
  input = '<a b="c">';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag with single quoted attribute with nested >
  input = '<a b=\'c>\'>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag with double quoted attribute with nested >
  input = '<a b="c>">';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);


  // Test: unclosed single quote attribute value with following >
  input = '<a b=\'c>';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing unclosed single quote input did not throw an exception');
  } catch(error) {
  }

  // Test: unclosed double quote attribute value with following >
  input = '<a b="c>';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing unclosed double quote input did not throw an exception');
  } catch(error) {
  }

  // Test: mismatched quotes single into double
  input = '<a b=\'c">';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing mismatched quotes single-double input did not throw an ' +
      'exception');
  } catch(error) {
  }

  // Test: mismatched quotes double into single
  input = '<a b="c\'>';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing mismatched quotes double-single input did not throw an ' +
      'exception');
  } catch(error) {
  }

  // Test: tag with attribute name and unquoted value
  input = '<a b=c>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag with single quotes nested in double quotes
  input = '<a b="javascript:alert(\'foo\')">';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag with double quotes nested in single quotes
  input = '<a b=\'javascript:alert("foo")\'>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag two unquoted attributes
  input = '<a b=c d=e>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: tag two quoted attributes
  // Note: fixed, was failing because end of quote states were reverting to
  // tag open state instead of tag open after name state
  input = '<a b="c" d="e">';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: basic empty comment
  input = '<!---->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: comment after text
  input = 'a<!---->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === 'a' &&
    tokens[1] === '<!---->', input);

  // Test: comment before text
  input = '<!---->b';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === '<!---->' &&
    tokens[1] === 'b', input);

  // Test comment with nested white space
  input = '<!-- \n\n\n -->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test comment with nested html
  input = '<!--\n<a b="c">d</e>\n-->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test comment with nested -
  input = '<!-- a - -->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test comment with nested --
  input = '<!-- a -- -->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test comment with ending -
  input = '<!-- a --->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test comment with ending --
  input = '<!-- a ---->';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: mismatched quotes double into single
  input = '<!-- uhoh';
  console.log('TEST:', input);
  try {
    tokens = tokenizeHTML(input);
    console.assert(false,
      'Tokenizing non-terminated comment did not throw error');
  } catch(error) {
  }

  // Test: basic processing instruction/xml declaration
  input = '<?xml?>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: processing instruction with basic attribute
  input = '<?PITarget PIContent?>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: processing instruction/xml declaration with quoted attributes
  input = '<?xml version="1.0" encoding="UTF-8"?>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: basic doctype
  input = '<!DOCTYPE>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: near basic doctype
  input = '<!DOCTYPE html>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: typical doctype
  input = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://' +
    'www.w3.org/TR/html4/strict.dtd">';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 1 && tokens[0] === input, input);

  // Test: basic style tag
  input = '<style></style>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 2 && tokens[0] === '<style>' &&
    tokens[1] === '</style>', input);

  // Test: basic style tag with space
  input = '<style> </style>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 3 && tokens[0] === '<style>' &&
    tokens[1] === ' ' && tokens[2] === '</style>', input);

  // Test: basic style tag with text
  input = '<style>abc</style>';
  console.log('TEST:', input);
  tokens = tokenizeHTML(input);
  console.assert(tokens.length === 3 && tokens[0] === '<style>' &&
    tokens[1] === 'abc' && tokens[2] === '</style>', input);



  // Test: style with quoted attributes
  // Test: style with multiline comments

  // Test: style containing html not </style>


  // TODO: test style
  // TODO: test script


});
