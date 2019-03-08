import {assert} from '/src/assert.js';
import * as mime from '/src/mime/mime.js';

export async function mime_test() {
  const a = assert;
  // constants tests
  a(mime.MIN_LENGTH < mime.MAX_LENGTH);
  a(mime.MIN_LENGTH >= 0);
  a(mime.MAX_LENGTH >= 0);

  // parse no input
  a(mime.parse_content_type() === undefined);

  // parse bad input
  a(mime.parse_content_type(1234) === undefined);
  a(mime.parse_content_type(false) === undefined);
  a(mime.parse_content_type(null) === undefined);
  a(mime.parse_content_type([]) === undefined);
  a(mime.parse_content_type({}) === undefined);


  // parse short input
  a(mime.parse_content_type('') === undefined);
  a(mime.parse_content_type('a') === undefined);

  // parse long input
  let long_string = '';
  for (let i = 0; i < 100; i++) {
    long_string += 'abc';
  }
  a(mime.parse_content_type(long_string) === undefined);

  // parse uppercase
  a(mime.parse_content_type('TEXT/HTML') === 'text/html');

  // parse mixed case
  a(mime.parse_content_type('TeXt/HTmL') === 'text/html');

  // parse no semicolon, no character encoding
  a(mime.parse_content_type('text/html') === 'text/html');
  // parse extra trimmable whitespace
  a(mime.parse_content_type(' \t\ntext/html  \n\t  ') === 'text/html');
  // parse typical input
  a(mime.parse_content_type('text/html;charset=UTF-8') === 'text/html');
  // parse space leading character encoding
  a(mime.parse_content_type('text/html; charset=UTF-8') === 'text/html');

  // parse extra whitespace
  a(mime.parse_content_type('text / html') === 'text/html');
  a(mime.parse_content_type('   text / html   ') === 'text/html');

  // fictional mime type with correct formatting and sufficient length
  a(mime.parse_content_type('foofoo/barbar') === 'foofoo/barbar');

  // duplicate slash
  a(mime.parse_content_type('text/lib/html/foo') === 'text/lib/html/foo');

  // duplicate semicolon
  a(mime.parse_content_type('text/html;;charset=UTF-8') === 'text/html');

  // is_valid tests
  a(mime.is_valid('text/html'));
  a(mime.is_valid('text/xml'));
  a(!mime.is_valid(false));
  a(!mime.is_valid(true));
  a(!mime.is_valid(-4321));
  a(!mime.is_valid('asdf'));
  a(!mime.is_valid('a b c'));
  a(!mime.is_valid('a b c / 123'));
  a(!mime.is_valid('text\\xml'));
}
