// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Creates and returns an opml document with the given title
function createOPMLDocument(titleString) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  const documentElement = doc.documentElement;
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  documentElement.appendChild(headElement);

  if(titleString) {
    const titleElement = doc.createElement('title');
    titleElement.textContent = titleString;
    headElement.appendChild(titleElement);
  }

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  // TODO: maybe I shouldn't create this here. We don't know if we will be
  // appending any feeds yet, so it kind of does not need to exist yet.
  const bodyElement = doc.createElement('body');
  documentElement.appendChild(bodyElement);

  return doc;
}

function appendFeedToOPMLDocument(document, feed) {
  let outlineElement = document.createElement('outline');
  outlineElement.setAttribute('type', feed.type || 'rss');

  const toString = Object.prototype.toString;

  if(toString.call(feed.url) === '[object URL]') {
    outlineElement.setAttribute('xmlUrl', feed.url.href);
  } else {
    outlineElement.setAttribute('xmlUrl', feed.url);
  }

  if(feed.title) {
    outlineElement.setAttribute('text', feed.title);
    outlineElement.setAttribute('title', feed.title || '');
  }

  if(feed.description) {
    outlineElement.setAttribute('description', feed.description);
  }

  if(feed.link) {
    if(toString.call(feed.link) === '[object URL]') {
      outlineElement.setAttribute('htmlUrl', feed.link.href);
    } else {
      outlineElement.setAttribute('htmlUrl', feed.link);
    }
  }

  let bodyElement = document.body;

  // Create the body element if it does not exist
  if(!bodyElement) {
    bodyElement = document.createElement('body');
    document.documentElement.appendChild(bodyElement);
  }

  bodyElement.appendChild(outlineElement);
}
