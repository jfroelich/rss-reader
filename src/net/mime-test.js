import {assert as a} from '/src/assert/assert.js';
import * as mime from '/src/net/mime.js';
import {register_test} from '/src/test/test-registry.js';

async function mime_test() {
  // constants tests
  a(mime.MIME_TYPE_MIN_LENGTH < mime.MIME_TYPE_MAX_LENGTH);
  a(mime.MIME_TYPE_MIN_LENGTH >= 0);
  a(mime.MIME_TYPE_MAX_LENGTH >= 0);

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
  a(mime.parse_content_type('text/html/foo') === 'text/html/foo');

  // duplicate semicolon
  a(mime.parse_content_type('text/html;;charset=UTF-8') === 'text/html');

  // is_mime_type tests
  a(mime.is_mime_type('text/html'));
  a(mime.is_mime_type('text/xml'));
  a(!mime.is_mime_type(false));
  a(!mime.is_mime_type(true));
  a(!mime.is_mime_type(-4321));
  a(!mime.is_mime_type('asdf'));
  a(!mime.is_mime_type('a b c'));
  a(!mime.is_mime_type('a b c / 123'));
  a(!mime.is_mime_type('text\\xml'));
}

register_test(mime_test);
