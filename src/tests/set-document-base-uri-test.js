import {set_document_base_uri} from '/src/lib/set-document-base-uri.js';
import {assert} from '/src/tests/assert.js';

export async function set_document_base_uri_test() {
  // If a document has no base elements, then this should add a base element
  // and that should become the baseURI value
  let title = 'no existing base';
  console.debug('testing', title);
  let doc = document.implementation.createHTMLDocument(title);
  let url = new URL('http://www.example.com');
  set_document_base_uri(doc, url);
  assert(doc.baseURI === url.href);

  // If a document has a base element, and that base element has a canonical
  // href value, then this should be a no-op.
  title = 'existing base with canonical href';
  console.debug('testing', title);
  doc = document.implementation.createHTMLDocument(title);
  let base = doc.createElement('base');
  base.setAttribute('href', 'http://www.example1.com/');
  doc.head.appendChild(base);
  // Before the change, is the document in the expected state
  assert(doc.baseURI === 'http://www.example1.com/');
  url = new URL('http://www.example2.com');
  set_document_base_uri(doc, url);
  // After the change, is the document in the expected state
  assert(doc.baseURI === 'http://www.example1.com/');

  // If a document has a base element, and that base element has an href value
  // that is not canonical, then this should resolve the href value to the
  // url, and replace the href value, and cause the baseURI to be the
  // canonical resolved value.
  title = 'existing base with non-canonical href';
  console.debug('testing', title);
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '/path');
  doc.head.appendChild(base);
  // Before the change, baseURI is the result of resolving the relative url to
  // the extension's base url (because that is the 'page' executing the script
  // that created the document without a base element).
  //
  // console.debug('extension url:', chrome.extension.getURL(''));
  // console.debug('before change for non-canon the base uri is', doc.baseURI);
  url = new URL('http://www.example.com');
  set_document_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example.com/path');

  // If a document has a base element, and that base element has an href value
  // that is not canonical, and that relative url has invalid syntax, then this
  // should still resolve the url as before, but the invalid portion will get
  // trimmed and url encoded as a path within the new base url
  // NOTE: this actually is not desired behavior, but it is expected behavior
  // in the current implementation
  title = 'existing base with non-canonical invalid href';
  console.debug('testing', title);
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '  \t\r\n   foo  bar     ');
  doc.head.appendChild(base);
  url = new URL('http://www.example.com');
  set_document_base_uri(doc, url);
  console.debug('base uri is ', doc.baseURI);
  assert(doc.baseURI === 'http://www.example.com/foo%20%20bar');


  // TODO: test 'missing a head element' basic case?
  // TODO: test for multiple existing bases? when multiple, first one with
  // href should be the one used
}
