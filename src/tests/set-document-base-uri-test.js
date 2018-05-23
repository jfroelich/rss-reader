import {set_document_base_uri} from '/src/lib/set-document-base-uri.js';
import {assert} from '/src/tests/assert.js';

export async function set_document_base_uri_test() {
  let title = 'no existing base';
  let doc = document.implementation.createHTMLDocument(title);
  let url = new URL('http://www.example.com');
  set_document_base_uri(doc, url);
  assert(doc.baseURI === url.href);

  title = 'existing base with canonical href';
  doc = document.implementation.createHTMLDocument(title);
  let base = doc.createElement('base');
  base.setAttribute('href', 'http://www.example1.com/');
  doc.head.appendChild(base);
  url = new URL('http://www.example2.com');
  set_document_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example1.com/');


  // TODO: test for one existing base non-canonical href
  // TODO: test for multiple existing bases
}
