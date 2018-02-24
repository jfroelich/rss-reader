import {url_is_binary} from '/src/sniff/sniff.js';

// TODO: use console.assert rather than throw exception
// TODO: test other functions in sniff.js

function assert(value) {
  if (!value) throw new Error('Assertion error');
}

let input = new URL('http://www.example.com/example.pdf');
let result = url_is_binary(input);
assert(result === true, input);

input = new URL('http://www.example.com/test.txt');
result = url_is_binary(input);
assert(result === false, input);

// Data URIs without a mime type should be text, because default is text/plain
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
input = new URL('data:foo');
result = url_is_binary(input);
assert(result === false, input);

input = new URL('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');
result = url_is_binary(input);
assert(result === false, input);

input = new URL('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E');
result = url_is_binary(input);
assert(result === false, input);

input = new URL('data:image/png;base64,junk=');
result = url_is_binary(input);
assert(result === true, input);

console.debug(
    'If no error messages appear in console before this then all tests passed');
