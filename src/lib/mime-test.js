import assert from '/src/lib/assert.js';
import * as mime from '/src/lib/mime.js';

export function mime_test() {
  const a = assert;
  const pct = mime.parse_content_type;

  // constants tests
  // (compensate for lack of static assertions in js)
  a(mime.MIN_LENGTH < mime.MAX_LENGTH);
  a(mime.MIN_LENGTH >= 0);
  a(mime.MAX_LENGTH >= 0);

  // no input
  a(!pct());

  // unsupported types
  a(!pct(1234));
  a(!pct(false));
  a(!pct(null));
  a(!pct([]));
  a(!pct({}));

  // short input
  a(!pct(''));
  a(!pct('a'));

  // long input
  let long_string = '';
  for (let i = 0; i < 100; i++) {
    long_string += 'abc';
  }
  a(!pct(long_string));

  // case normalization
  a(pct('TEXT/HTML') === 'text/html');
  a(pct('TeXt/HTmL') === 'text/html');

  // no semicolon, no character encoding
  a(pct('text/html') === 'text/html');

  // TODO: if header values in http responses are supposed to be a single line,
  // then maybe it is more correct to not support line breaks

  // extra trimmable whitespace
  a(pct(' \t\ntext/html  \n\t  ') === 'text/html');
  // typical input with character encoding without leading space
  a(pct('text/html;charset=UTF-8') === 'text/html');
  // typical input with space leading character encoding
  a(pct('text/html; charset=UTF-8') === 'text/html');

  // extra intermediate whitespace
  a(pct('text / html') === 'text/html');
  // extra intermediate and wrapping whitespace
  a(pct('   text / html   ') === 'text/html');

  // fictional mime type
  a(pct('foofoo/barbar') === 'foofoo/barbar');

  // duplicate slash
  // TODO: eventually the parse function should be revised to return undefined
  // for now this test just documents this pathological case
  a(pct('text/lib/html/foo') === 'text/lib/html/foo');

  // duplicate semicolon
  // TODO: eventually the parse function should be revised to return undefined
  // for now just document this case
  a(pct('text/html;;charset=UTF-8') === 'text/html');

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
