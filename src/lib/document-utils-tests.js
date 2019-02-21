import {assert} from '/src/lib/assert.js';
import * as document_utils from '/src/lib/document-utils.js';

export async function set_base_uri_test() {
  // If a document has no base elements, and overwrite is true, then this should
  // add a base element and that should become the baseURI value, and there
  // should only be one base element
  let title = 'no existing base and overwrite';
  let doc = document.implementation.createHTMLDocument(title);
  let url = new URL('http://www.example.com');
  document_utils.set_base_uri(doc, url, true);
  assert(doc.baseURI === url.href);
  assert(doc.querySelectorAll('base').length === 1);

  // if a document has no base elements, and overwrite is false, then this
  // should add a base element and that should become the baseURI value
  title = 'no existing base and not overwrite';
  doc = document.implementation.createHTMLDocument(title);
  url = new URL('http://www.example.com');
  document_utils.set_base_uri(doc, url, false);
  assert(doc.baseURI === url.href);
  assert(doc.getElementsByTagName('base').length === 1);

  // If a document has a base element, and that base element has a canonical
  // href value, and overwrite is false then this should be a no-op.
  title = 'existing base with canonical href';
  doc = document.implementation.createHTMLDocument(title);
  let base = doc.createElement('base');
  base.setAttribute('href', 'http://www.example1.com/');
  doc.head.appendChild(base);
  assert(doc.baseURI === 'http://www.example1.com/');
  url = new URL('http://www.example2.com');
  document_utils.set_base_uri(doc, url, false);
  // After the change, is the document in the expected state
  assert(doc.baseURI === 'http://www.example1.com/');
  assert(doc.getElementsByTagName('base').length === 1);

  // If a document has a base element, and that base element has an href value
  // that is not canonical, then this should resolve the href value to the
  // url, and replace the href value, and cause the baseURI to be the
  // canonical resolved value.
  title = 'existing base with non-canonical href';
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '/path');
  doc.head.appendChild(base);
  // Before the change, baseURI is the result of resolving the relative url to
  // the extension's base url (because that is the 'page' executing the script
  // that created the document without a base element).
  url = new URL('http://www.example.com');
  document_utils.set_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example.com/path');

  // If a document has a base element, and that base element has an href value
  // that is not canonical, and that relative url has invalid syntax, then this
  // should still resolve the url as before, but the invalid portion will get
  // trimmed and url encoded as a path within the new base url
  // NOTE: this actually is not desired behavior, but it is expected behavior
  // in the current implementation
  title = 'existing base with non-canonical invalid href';
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '  \t\r\n   foo  bar     ');
  doc.head.appendChild(base);
  url = new URL('http://www.example.com');
  document_utils.set_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example.com/foo%20%20bar');
}
