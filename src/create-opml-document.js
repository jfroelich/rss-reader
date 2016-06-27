// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Creates and returns an opml document with the given title and containing
// the given feeds as outline elements
function createOPMLDocument(titleString, feeds) {
  const doc = document.implementation.createDocument(null, 'OPML', null);
  const documentElement = doc.documentElement;
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('HEAD');
  documentElement.appendChild(headElement);

  const titleElement = doc.createElement('TITLE');
  titleElement.textContent = titleString || '';
  headElement.appendChild(titleElement);

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('DATECREATED');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('DATEMODIFIED');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('DOCS');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('BODY');
  documentElement.appendChild(bodyElement);

  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let feed of feeds) {
  for(let i = 0, len = feeds.length; i < len; i++) {
    let feed = feeds[i];
    let outlineElement = doc.createElement('OUTLINE');
    outlineElement.setAttribute('type', feed.type || 'rss');

    if(Object.prototype.toString.call(feed.url) === '[object URL]') {
      outlineElement.setAttribute('xmlUrl', feed.url.href);
    } else {
      outlineElement.setAttribute('xmlUrl', feed.url);
    }

    outlineElement.setAttribute('text', feed.title || '');
    outlineElement.setAttribute('title', feed.title || '');
    outlineElement.setAttribute('description', feed.description || '');

    if('link' in feed && feed.link) {
      if(Object.prototype.toString.call(feed.link) === '[object URL]') {
        outlineElement.setAttribute('htmlUrl', feed.link.href);
      } else {
        outlineElement.setAttribute('htmlUrl', feed.link);
      }
    }

    bodyElement.appendChild(outlineElement);
  }

  return doc;
}
