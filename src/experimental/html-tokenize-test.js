import assert from "/src/utils/assert.js";

let input;
let tokens;

/////////////////////////////////////////////////////////
// Test abnormal inputs

// Test: undefined input
input = undefined;
console.log('TEST:', '(undefined)');
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing undefined input did not throw an exception');
} catch(error) {
  // console.debug(error);
}

// Test: null input
input = null;
console.log('TEST:', '(null)');
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing null input did not throw an exception');
} catch(error) {
  // console.debug(error);
}

// Test: numerical input
input = 123;
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing numerical input did not throw an exception');
} catch(error) {
  // console.debug(error);
}

// Test: boolean input
input = true;
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing boolean input did not throw an exception');
} catch(error) {
  // console.debug(error);
}

// Test: Date object input
input = new Date();
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing Date object input did not throw an exception');
} catch(error) {
}

// Test: basic object input
input = {'foo': 'bar', 'length': 123};
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing basic object input did not throw an exception');
} catch(error) {
}

// Test: array of strings input
input = ['a', 'b', 'c'];
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing string array input did not throw an exception');
} catch(error) {
}

// Test: zero length string
input = '';
console.log('TEST:', '(zero length string)');
tokens = tokenizeHTML(input);
assert(tokens.length === 0, 'zero length string input');

// Test: string of spaces
input = '   ';
console.log('TEST:', '(string of 3 spaces)');
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: string with some other whitespace
input = ' \n \t \r\n  ';
console.log('TEST:', '(string with various whitespace)');
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: single <
input = '<';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false, 'Tokenizing < did not throw an exception');
} catch(error) {
  // console.debug(error);
}

// Test: single > floating in text
input = ' > ';
console.log('TEST:', input);
tokens = tokenizeHTML(input);;
assert(tokens.length === 1 && tokens[0] === input, input);


////////////////////////////////////////////////////////////
// Test basic inputs

// Test: text
input = 'All Text Input 0123456789';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: text with floating > input
input = 'a > b';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test single quote in text
input = 'a\'b';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);


// Test double quote in text
input = 'a"b';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);


// Test: single starting tag
input = '<p>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: single ending tag
input = '</p>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: closed tag
input = '<br/>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: text before single tag
input = 'a</b>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === 'a' &&
  tokens[1] === '</b>', input);

// Test: text after single tag
input = '</b>a';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '</b>' &&
  tokens[1] === 'a', input);

// Test: basic open and close tag
input = '<p>a</p>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<p>' &&
  tokens[1] === 'a' && tokens[2] === '</p>', input);

// Test: tag name with whitespace in body
input = '<p  >a';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<p  >' &&
  tokens[1] === 'a', input);

// Test: tag body containing tag
input = '<p<a>>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<p<a>' &&
  tokens[1] === '>', input);

///////////////////////////////////////////////////////////////////
// Tag attribute tests

// Test: tag body with attribute name
input = '<p style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag body with single quoted attribute value
input = '<a b=\'c\'>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag body with double quoted attribute value
input = '<a b="c">';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag with single quoted attribute with nested >
input = '<a b=\'c>\'>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag with double quoted attribute with nested >
input = '<a b="c>">';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);


// Test: unclosed single quote attribute value with following >
input = '<a b=\'c>';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing unclosed single quote input did not throw an exception');
} catch(error) {
}

// Test: unclosed double quote attribute value with following >
input = '<a b="c>';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing unclosed double quote input did not throw an exception');
} catch(error) {
}

// Test: mismatched quotes single into double
input = '<a b=\'c">';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing mismatched quotes single-double input did not throw an ' +
    'exception');
} catch(error) {
}

// Test: mismatched quotes double into single
input = '<a b="c\'>';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing mismatched quotes double-single input did not throw an ' +
    'exception');
} catch(error) {
}

// Test: tag with attribute name and unquoted value
input = '<a b=c>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag with single quotes nested in double quotes
input = '<a b="javascript:alert(\'foo\')">';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag with double quotes nested in single quotes
input = '<a b=\'javascript:alert("foo")\'>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag two unquoted attributes
input = '<a b=c d=e>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: tag two quoted attributes
// Note: fixed, was failing because end of quote states were reverting to
// tag open state instead of tag open after name state
input = '<a b="c" d="e">';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: basic empty comment
input = '<!---->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: comment after text
input = 'a<!---->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === 'a' &&
  tokens[1] === '<!---->', input);

// Test: comment before text
input = '<!---->b';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<!---->' &&
  tokens[1] === 'b', input);

// Test comment with nested white space
input = '<!-- \n\n\n -->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test comment with nested html
input = '<!--\n<a b="c">d</e>\n-->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test comment with nested -
input = '<!-- a - -->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test comment with nested --
input = '<!-- a -- -->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test comment with ending -
input = '<!-- a --->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test comment with ending --
input = '<!-- a ---->';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: mismatched quotes double into single
input = '<!-- uhoh';
console.log('TEST:', input);
try {
  tokens = tokenizeHTML(input);
  assert(false,
    'Tokenizing non-terminated comment did not throw error');
} catch(error) {
}

// Test: basic processing instruction/xml declaration
input = '<?xml?>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: processing instruction with basic attribute
input = '<?PITarget PIContent?>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: processing instruction/xml declaration with quoted attributes
input = '<?xml version="1.0" encoding="UTF-8"?>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: basic doctype
input = '<!DOCTYPE>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: near basic doctype
input = '<!DOCTYPE html>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: typical doctype
input = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://' +
  'www.w3.org/TR/html4/strict.dtd">';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 1 && tokens[0] === input, input);

// Test: basic style tag
input = '<style></style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<style>' &&
  tokens[1] === '</style>', input);

// Test: basic style tag with space
input = '<style> </style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === ' ' && tokens[2] === '</style>', input);

// Test: basic style tag with new lines
input = '<style> \n\n </style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === ' \n\n ' && tokens[2] === '</style>', input);

// Test: basic style tag with text
input = '<style>abc</style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === 'abc' && tokens[2] === '</style>', input);

// Test: basic style tag with basic attribute
input = '<style attribute></style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<style attribute>' &&
  tokens[1] === '</style>', input);

// Test: basic style tag with quoted attribute
input = '<style attribute=\'value\'></style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 &&
  tokens[0] === '<style attribute=\'value\'>' &&
  tokens[1] === '</style>', input);

// Test: basic style tag with quoted attribute
input = '<style attribute="value"></style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 &&
  tokens[0] === '<style attribute="value">' &&
  tokens[1] === '</style>', input);

// Test: basic style tag with comment
input = '<style>a/*b*/c</style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === 'a/*b*/c' && tokens[2] === '</style>', input);

// Test: basic style tag with comment spanning lines
input = '<style>a/*\n\nb\n\n*/c</style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === 'a/*\n\nb\n\n*/c' && tokens[2] === '</style>', input);

// Test: basic style tag with comment containing style tag
input = '<style>a/*</style>*/c</style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === 'a/*</style>*/c' && tokens[2] === '</style>', input);

// Test: basic style tag with comment containing **
input = '<style>a/****/c</style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === 'a/****/c' && tokens[2] === '</style>', input);

// Test: malformed style containing html
input = '<style><p>bad</p></style>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<style>' &&
  tokens[1] === '<p>bad</p>' && tokens[2] === '</style>', input);


// Test: script tag
input = '<script></script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 && tokens[0] === '<script>' &&
  tokens[1] === '</script>', input);

// Test: script tag with space
input = '<script> </script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<script>' &&
  tokens[1] === ' ' &&
  tokens[2] === '</script>', input);

// Test: script tag with new lines
input = '<script> \n\n </script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 && tokens[0] === '<script>' &&
  tokens[1] === ' \n\n ' &&
  tokens[2] === '</script>', input);

// Test: script tag with attributes
input = '<script type="text/javascript"></script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 2 &&
  tokens[0] === '<script type="text/javascript">' &&
  tokens[1] === '</script>', input);

// Test: script tag with single line comment terminated by LF
input = '<script>a//b\n</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'a//b\n' &&
  tokens[2] === '</script>', input);

// Test: script tag with single line comment terminated by CRLF
input = '<script>a//b\r\n</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'a//b\r\n' &&
  tokens[2] === '</script>', input);

// Test: script tag with single line comment containing html
input = '<script>a//<evil>\n</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'a//<evil>\n' &&
  tokens[2] === '</script>', input);

// Test: script tag with empty multine line comment
input = '<script>/**/</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === '/**/' &&
  tokens[2] === '</script>', input);

// Test: script tag with multine line comment with new lines
input = '<script>/*\n\n\n\t\n*/</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === '/*\n\n\n\t\n*/' &&
  tokens[2] === '</script>', input);

// Test: script tag with multiline comment with *
input = '<script>/*adsf***/</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === '/*adsf***/' &&
  tokens[2] === '</script>', input);

// Test: script tag with multiline comment containing end tag
input = '<script>/*</script>*/</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === '/*</script>*/' &&
  tokens[2] === '</script>', input);

// Test: script tag with single quote value
input = '<script>var a = \'b\';</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = \'b\';' &&
  tokens[2] === '</script>', input);

// Test: script tag with single quote value with escaped quote
input = '<script>var a = \'\\\'b\';</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = \'\\\'b\';' &&
  tokens[2] === '</script>', input);

// Test: script tag with double quote value
input = '<script>var a = "b";</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = "b";' &&
  tokens[2] === '</script>', input);

// Test: script tag with double quote value with escaped quote
input = '<script>var a = "\\"b";</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = "\\"b";' &&
  tokens[2] === '</script>', input);

// Test: script tag with less than expression
input = '<script>if(a<b) console.log("c");</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'if(a<b) console.log("c");' &&
  tokens[2] === '</script>', input);

// Test: script tag with template literal (backquotes)
input = '<script>var a = `backquoted`;</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = `backquoted`;' &&
  tokens[2] === '</script>', input);

// Test: script tag with mixed quotes
input = '<script>var a = \'"as`df"\';</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = \'"as`df"\';' &&
  tokens[2] === '</script>', input);


// TODO: THIS FAILS

// Test: script tag with regular expression literal
input = '<script>var a = /[a-z]/i;</script>';
console.log('TEST:', input);
tokens = tokenizeHTML(input);
assert(tokens.length === 3 &&
  tokens[0] === '<script>' &&
  tokens[1] === 'var a = /[a-z]/i;' &&
  tokens[2] === '</script>', input);



// TODO: test </script whitespace >
