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

  for(let file of files) {
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
    if(!docElement) {
      onFileProcessed();
      return;
    }

    if(!equalsIgnoreCase(docElement.nodeName, 'OPML')) {
      onFileProcessed();
      return;
    }

    const bodyElement = document.body;
    if(!bodyElement) {
      onFileProcessed();
      return;
    }

    const seenURLs = Object.create(null);

    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {
      if(!equalsIgnoreCase(element.nodeName, 'OUTLINE')) {
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

      if(url.href in seenURLs) {
        continue;
      }
      seenURLs[url.href] = 1;

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
    // NOOP
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
