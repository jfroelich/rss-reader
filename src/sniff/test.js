import * as sniff from '/src/sniff/sniff.js';

let input = new URL('http://www.example.com/example.pdf');
let result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input);

input = new URL('http://www.example.com/test.txt');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input);

input = new URL('http://www.example.com/test.asdf');
result = sniff.classify(input);
console.assert(result === sniff.UNKNOWN_CLASS, input);

input = new URL('data:foo');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input);

input = new URL('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input);

input = new URL('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E');
result = sniff.classify(input);
console.assert(result === sniff.TEXT_CLASS, input);

input = new URL('data:image/png;base64,junk=');
result = sniff.classify(input);
console.assert(result === sniff.BINARY_CLASS, input);

console.debug(
    'If no error messages appear in console before this message',
    'then all tests passed');
