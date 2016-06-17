// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for importing and exporting opml files
const OPML = {};

// Creates and returns an opml document with the given title and containing
// the given feeds as outline elements
OPML.createDocument = function(titleString, feeds) {
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

  let outlineElement;
  for(let feed of feeds) {
    outlineElement = doc.createElement('OUTLINE');
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
};

// Imports an array of files representing OPML documents. Calls callback when
// complete.
OPML.importFiles = function(connection, files, callback) {

  const filesProcessed = 0;
  const numFiles = files.length;

  if(!numFiles) {
    callback();
    return;
  }

  const reader = new FileReader();
  reader.onload = onFileRead;
  reader.onerror = onFileRead;
  const parser = new DOMParser();

  for(let i = 0; i < numFiles; i++) {
    reader.readAsText(files[i]);
  }

  function onFileRead(event) {
    filesProcessed++;

    if(event.type === 'error') {
      console.debug(event);
      onFileProcessed();
      return;
    }

    const fileText = event.target.result;
    let document = null;
    try {
      document = parser.parseFromString(fileText, 'application/xml');
    } catch(exception) {
      console.debug(exception);
      onFileProcessed();
      return;
    }

    if(!document) {
      console.debug('Undefined document');
      onFileProcessed();
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.debug(parserError.textContent);
      onFileProcessed();
      return;
    }

    const docElement = document.documentElement;
    if(!docElement) {
      console.debug('No document element');
      onFileProcessed();
      return;
    }

    if(!utils.string.equalsIgnoreCase(docElement.nodeName, 'OPML')) {
      console.debug('Non-OPML document element');
      onFileProcessed();
      return;
    }

    const bodyElement = document.body;
    if(!bodyElement) {
      console.debug('No body element found');
      onFileProcessed();
      return;
    }

    const seenURLs = {};

    for(let element = bodyElement.firstElementChild, type, url, urlString,
      outline, normalizedURLString, outlineLinkURL; element;
      element = element.nextElementSibling) {
      if(!utils.string.equalsIgnoreCase(element.nodeName, 'OUTLINE')) {
        continue;
      }

      type = element.getAttribute('type');
      if(!type || type.length < 3 || !/rss|rdf|feed/i.test(type)) {
        continue;
      }

      urlString = (element.getAttribute('xmlUrl') || '').trim();
      if(!urlString) {
        continue;
      }

      url = toURLTrapped(urlString);
      if(!url) {
        continue;
      }

      normalizedURLString = url.href;

      if(normalizedURLString in seenURLs) {
        continue;
      }
      seenURLs[normalizedURLString] = 1;

      outline = Object.create(null);
      outline.type = type;
      outline.title = sanitizeString(element.getAttribute('title') ||
        element.getAttribute('text'));
      outline.description = sanitizeString(element.getAttribute('description'));

      outline.urls = [url];

      outlineLinkURL = toURLTrapped(
        sanitizeString(element.getAttribute('htmlUrl')));
      if(outlineLinkURL) {
        outline.link = outlineLinkURL;
      }

      // Note this does not wait before continuing which leaves requests
      // pending
      putFeed(connection, null, outline);
    }

    onFileProcessed();
  }

  // Trap the exception
  function toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {}
  }

  // TODO: consider max length of each field and the behavior when exceeded
  function sanitizeString(inputString) {
    let outputString = inputString || '';
    if(outputString) {
      outputString = utils.string.filterControlCharacters(outputString);
      outputString = HTMLUtils.replaceTags(outputString, '');
    }
    return outputString.trim();
  }

  function onFileProcessed() {
    if(filesProcessed === numFiles) {
      // TODO: show a notification before calling back
      callback();
    }
  }
};
