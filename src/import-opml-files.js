// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Imports an array of files representing OPML documents
function importOPMLFiles(connection, files, callback) {
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

  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  for(let i = 0, len = files.length; i < len; i++) {
    let file = files[i];
    reader.readAsText(file);
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

    // TODO: I don't think this ever happens, not sure
    if(!docElement) {
      onFileProcessed();
      return;
    }

    if(docElement.nodeName.toUpperCase() !== 'OPML')) {
      onFileProcessed();
      return;
    }

    const bodyElement = document.body;
    if(!bodyElement) {
      onFileProcessed();
      return;
    }

    //const seenURLs = Object.create(null);
    const seenURLStringSet = new Set();

    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.nodeName.toUpperCase() !== 'OUTLINE')) {
        continue;
      }

      let type = element.getAttribute('type');
      if(!type || type.length < 3 || !/rss|rdf|feed/i.test(type)) {
        continue;
      }

      let urlString = (element.getAttribute('xmlUrl') || '').trim();
      if(!urlString) {
        continue;
      }

      let url = toURLTrapped(urlString);
      if(!url) {
        continue;
      }

      //if(url.href in seenURLs) {
      if(seenURLStringSet.has(url.href)) {
        continue;
      }
      //seenURLs[url.href] = 1;
      seenURLStringSet.add(url.href);

      // Create the feed object that will be stored
      let feed = Object.create(null);
      feed.urls = [url.href];
      feed.type = type;
      feed.title = sanitizeString(element.getAttribute('title') ||
        element.getAttribute('text'));
      feed.description = sanitizeString(element.getAttribute('description'));

      let outlineLinkURL = toURLTrapped(element.getAttribute('htmlUrl'));
      if(outlineLinkURL) {
        feed.link = outlineLinkURL.href;
      }

      db.addFeed(connection, feed, onAddFeed);
    }

    onFileProcessed();
  }

  function onAddFeed(event) {
    if(event.type === 'success') {
      console.debug('Imported feed with new id', event.target.result);
    } else {
      console.debug('Import error', event);
    }
  }

  // Trap the exception
  function toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {}
  }

  // TODO: this overlaps with poll functionality, should probably make a
  // general purpose function that is shared
  // TODO: consider max length of each field and the behavior when exceeded
  function sanitizeString(inputString) {
    let outputString = inputString || '';
    if(outputString) {
      outputString = filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');
      outputString = outputString.replace(/\s+/, ' ');
    }
    return outputString.trim();
  }

  function onFileProcessed() {
    if(filesProcessed === numFiles) {
      // TODO: show a notification before calling back?
      callback();
    }
  }
}
