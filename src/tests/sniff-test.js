import * as sniff from '/src/lib/sniff/sniff.js';

console.debug('If no other messages appear in console then all tests passed');

// expected binary output
let input = new URL('http://www.example.com/example.pdf');
let result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input);

// test with sub folder, expect to find binary
input = new URL('http://www.example.com/folder/example.pdf');
result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input);

// test with multiple periods, expect to find binary
input = new URL('http://www.example.com/folder/e.x.a.m.p.le.pdf');
result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input);

// expected text output
input = new URL('http://www.example.com/test.txt');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input);

// expected unknown output
input = new URL('http://www.example.com/test.asdf');
result = sniff.classify(input);
console.assert(result === sniff.UNKNOWN_CLASS, input.href);

// implicit default data uri
input = new URL('data:foo');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input.href);

// explicitly typed data uri as text
input = new URL('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input.href);

// explicitly typed data uri as text alternate, no encoding
input = new URL('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input.href);

// explicitly typed binary data uri
input = new URL('data:image/png;base64,junk=');
result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input.href);

// expected to find typical file name extension
input = new URL('http://www.a.com/b.html');
result = sniff.url_get_extension(input);
console.assert(result === 'html', input.href);

// trailing period, should not find extension
input = new URL('http://www.a.com/b.');
result = sniff.url_get_extension(input);
console.assert(!result, input.href);

// leading period should find extension
input = new URL('http://www.a.com/.htaccess');
result = sniff.url_get_extension(input);
console.assert(result === 'htaccess', input.href);

// extension too long, should not find extension
input = new URL('http://www.a.com/b.01234567890123456789asdf');
result = sniff.url_get_extension(input);
console.assert(!result, input.href);

// expect to find mime type
input = new URL('data:image/png;base64,junk=');
result = sniff.find_mime_type_in_data_url(input);
console.assert(result === 'image/png', input.href);

// expect not to find mime type so expect default
input = new URL('data:foo');
result = sniff.find_mime_type_in_data_url(input);
console.assert(result === 'text/plain', input.href);

// expected output is type text
input = 'text/plain';
result = sniff.mime_type_is_binary(input);
console.assert(result === sniff.TEXT_CLASS, input);

// expected output is type text (exception to application super type)
input = 'application/xml';
result = sniff.mime_type_is_binary(input);
console.assert(result === sniff.TEXT_CLASS, input);

// expected output is type binary, application
input = 'application/octet-stream';
result = sniff.mime_type_is_binary(input);
console.assert(result === sniff.BINARY_CLASS, input);

// expected output is type binary, audio
input = 'audio/mp3';
result = sniff.mime_type_is_binary(input);
console.assert(result === sniff.BINARY_CLASS, input);

// expected output is unknown (mime type must be long enough to be valid)
input = 'foofoo/barbar';
result = sniff.mime_type_is_binary(input);
console.assert(result === sniff.UNKNOWN_CLASS, input);
