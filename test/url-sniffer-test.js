import * as urlSniffer from '/lib/url-sniffer.js';
import assert from '/lib/assert.js';

export default function () {
  // Local aliases
  const { BINARY_CLASS } = urlSniffer;
  const { TEXT_CLASS } = urlSniffer;
  const { UNKNOWN_CLASS } = urlSniffer;

  // expected binary output
  let input = new URL('http://www.example.com/example.pdf');
  let result = urlSniffer.classify(input);
  assert(result === BINARY_CLASS);

  // test with sub folder, expect to find binary
  input = new URL('http://www.example.com/folder/example.pdf');
  result = urlSniffer.classify(input);
  assert(result === BINARY_CLASS);

  // test with multiple periods, expect to find binary
  input = new URL('http://www.example.com/folder/e.x.a.m.p.le.pdf');
  result = urlSniffer.classify(input);
  assert(result === BINARY_CLASS);

  // expected text output
  input = new URL('http://www.example.com/test.txt');
  result = urlSniffer.classify(input);
  assert(result === TEXT_CLASS);

  // expected unknown output
  input = new URL('http://www.example.com/test.asdf');
  result = urlSniffer.classify(input);
  assert(result === UNKNOWN_CLASS);

  // data uri without explicit content type
  input = new URL('data:foo');
  result = urlSniffer.classify(input);
  assert(result === TEXT_CLASS);

  // data uri with explicit content type of type text
  input = new URL('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');
  result = urlSniffer.classify(input);
  assert(result === TEXT_CLASS);

  // data uri with explicit content type of type text (but not text/plain)
  input = new URL('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E');
  result = urlSniffer.classify(input);
  assert(result === TEXT_CLASS);

  // data uri with an explicit binary content type
  input = new URL('data:image/png;base64,junk=');
  result = urlSniffer.classify(input);
  assert(result === BINARY_CLASS);

  // test finding of mime type of data uri with explicit binary content type
  input = new URL('data:image/png;base64,junk=');
  result = urlSniffer.dataURIFindMimeType(input);
  assert(result === 'image/png');

  // test failure to find mime type of data uri defaults to the default
  input = new URL('data:foo');
  result = urlSniffer.dataURIFindMimeType(input);
  assert(result === 'text/plain');

  // expected output is type text
  input = 'text/plain';
  result = urlSniffer.mimeTypeIsBinary(input);
  assert(result === TEXT_CLASS);

  // expected output is type text (exception to application super type)
  input = 'application/xml';
  result = urlSniffer.mimeTypeIsBinary(input);
  assert(result === TEXT_CLASS);

  // expected output is type binary, application
  input = 'application/octet-stream';
  result = urlSniffer.mimeTypeIsBinary(input);
  assert(result === BINARY_CLASS);

  // expected output is type binary, audio
  input = 'audio/mp3';
  result = urlSniffer.mimeTypeIsBinary(input);
  assert(result === BINARY_CLASS);

  // expected output is unknown (mime type must be long enough to be valid)
  input = 'foofoo/barbar';
  result = urlSniffer.mimeTypeIsBinary(input);
  assert(result === UNKNOWN_CLASS);
}
