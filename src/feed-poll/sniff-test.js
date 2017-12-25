import assert from "/src/utils/assert.js";
import isBinaryURL from "/src/feed-poll/sniff.js";

let input = new URL('http://www.example.com/example.pdf');
let result = isBinaryURL(input);
assert(result === true, input);

input = new URL('http://www.example.com/test.txt');
result = isBinaryURL(input);
assert(result === false, input);

// Data URIs without a mime type should be text, because default is text/plain
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
input = new URL('data:foo');
result = isBinaryURL(input);
assert(result === false, input);

input = new URL('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');
result = isBinaryURL(input);
assert(result === false, input);

input = new URL('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E');
result = isBinaryURL(input);
assert(result === false, input);

input = new URL('data:image/png;base64,junk=');
result = isBinaryURL(input);
assert(result === true, input);

console.debug('If no error messages appear in console before this then all tests passed');
