import * as mime from '/src/mime/mime.js';

console.log('starting tests');

const a = console.assert;

// constants tests
a(mime.MIME_TYPE_MIN_LENGTH < mime.MIME_TYPE_MAX_LENGTH);
a(mime.MIME_TYPE_MIN_LENGTH >= 0);
a(mime.MIME_TYPE_MAX_LENGTH >= 0);

// mime_type_from_content_type tests
// no input
a(mime.mime_type_from_content_type() === undefined);

// bad input
a(mime.mime_type_from_content_type(1234) === undefined);
a(mime.mime_type_from_content_type(false) === undefined);
a(mime.mime_type_from_content_type(null) === undefined);
a(mime.mime_type_from_content_type([]) === undefined);
a(mime.mime_type_from_content_type({}) === undefined);


// short string input
a(mime.mime_type_from_content_type('') === undefined);
a(mime.mime_type_from_content_type('a') === undefined);

// long string input
let long_string = '';
for (let i = 0; i < 100; i++) {
  long_string += 'abc';
}
a(mime.mime_type_from_content_type(long_string) === undefined);



// uppercase
a(mime.mime_type_from_content_type('TEXT/HTML') === 'text/html');

// mixed case
a(mime.mime_type_from_content_type('TeXt/HTmL') === 'text/html');


// no semicolon no character encoding
a(mime.mime_type_from_content_type('text/html') === 'text/html');
// extra trimmable whitespace
a(mime.mime_type_from_content_type(' \t\ntext/html  \n\t  ') === 'text/html');
// typical input
a(mime.mime_type_from_content_type('text/html;charset=UTF-8') === 'text/html');
// space leading character encoding
a(mime.mime_type_from_content_type('text/html; charset=UTF-8') === 'text/html');

// extra whitespace
a(mime.mime_type_from_content_type('text / html') === 'text/html');
a(mime.mime_type_from_content_type('   text / html   ') === 'text/html');

// fictional mime type with correct formatting and sufficient length
a(mime.mime_type_from_content_type('foofoo/barbar') === 'foofoo/barbar');

// duplicate slash
a(mime.mime_type_from_content_type('text/html/foo') === 'text/html/foo');

// duplicate semicolon
a(mime.mime_type_from_content_type('text/html;;charset=UTF-8') === 'text/html');


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

console.log('tests completed');
