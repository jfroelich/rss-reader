// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: unfinished refactoring

class OPMLImportService {

  constructor() {
    this.log = new LoggingService();
  }

  start(connection, files, callback) {
    const context = {
      'filesProcessed': 0,
      'numFiles': files.length
      'callback': callback
    };

    if(!context.numFiles) {
      callback();
      return;
    }

    const reader = new FileReader();
    const boundOnFileRead = this.onFileRead.bind(this, context);
    reader.onload = boundOnFileRead;
    reader.onerror = boundOnFileRead;
    for(let file of files) {
      reader.readAsText(file);
    }
  }

  onFileProcessed(context) {
    filesProcessed++;
    if(context.filesProcessed === context.numFiles) {
      context.callback();
    }
  }

  onFileRead(context, event) {
    if(event.type === 'error') {
      this.log.error(event);
      this.onFileProcessed(context);
      return;
    }

    const parser = new DOMParser();
    const fileText = event.target.result;
    let document = null;
    try {
      document = parser.parseFromString(fileText, 'application/xml');
    } catch(exception) {
      this.log.debug(exception);
      this.onFileProcessed(context);
      return;
    }

    if(!document) {
      this.onFileProcessed(context);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      this.log.debug(parserError.textContent);
      this.onFileProcessed(context);
      return;
    }

    const docElement = document.documentElement;
    if(docElement.nodeName.toUpperCase() !== 'OPML') {
      this.onFileProcessed(context);
      return;
    }

    const bodyElement = document.body;
    if(!bodyElement) {
      this.onFileProcessed(context);
      return;
    }

    const seenURLStringSet = new Set();

    const boundOnAddFeed = this.onAddFeed.bind(this, context);

    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.nodeName.toUpperCase() !== 'OUTLINE') {
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

      let url = this.toURLTrapped(urlString);
      if(!url) {
        continue;
      }

      if(seenURLStringSet.has(url.href)) {
        continue;
      }
      seenURLStringSet.add(url.href);

      // Create the feed object that will be stored
      let feed = Object.create(null);
      feed.urls = [url.href];
      feed.type = type;
      feed.title = this.sanitizeString(element.getAttribute('title') ||
        element.getAttribute('text'));
      feed.description = this.sanitizeString(
        element.getAttribute('description'));
      let outlineLinkURL = this.toURLTrapped(
        element.getAttribute('htmlUrl'));
      if(outlineLinkURL) {
        feed.link = outlineLinkURL.href;
      }

      db.addFeed(context.connection, feed, boundOnAddFeed);
    }

    this.onFileProcessed(context);
  }

  toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {}
  }

  // TODO: this overlaps with poll functionality, should probably make a
  // general purpose function that is shared
  // TODO: consider max length of each field and the behavior when exceeded
  sanitizeString(inputString) {
    let outputString = inputString || '';
    if(outputString) {
      outputString = filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');
      outputString = outputString.replace(/\s+/, ' ');
    }
    return outputString.trim();
  }

  onAddFeed(context, event) {
    if(event.type === 'success') {
      this.log.debug('Imported feed with new id', event.target.result);
    } else {
      this.log.error('Import error', event);
    }
  }
}
