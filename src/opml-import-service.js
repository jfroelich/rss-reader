// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class OPMLImportService {

  constructor() {
    this.cache = new FeedCache();
  }

  start(callback) {
    console.debug('Importing OPML files...');

    // TODO: if context.uploader is defined there is no need to define
    // context.files

    const context = {
      'filesProcessed': 0,
      'files': null,
      'callback': callback,
      'uploader': null
    };

    context.uploader = document.createElement('input');
    context.uploader.setAttribute('type', 'file');
    context.uploader.style.display = 'none';
    context.uploader.addEventListener('change',
      this.onUploaderChange.bind(this, context));
    const container = document.body || document.documentElement;
    container.appendChild(context.uploader);
    context.uploader.click();
  }

  onUploaderChange(context, event) {
    console.debug('Received uploader change event');
    context.uploader.removeEventListener('change', this.onUploaderChange);
    context.files = context.uploader.files;
    if(!context.files || !context.files.length) {
      console.warn('No files uploaded');
      context.uploader.remove();
      context.callback();
      return;
    }

    this.cache.open(this.onOpenDatabase.bind(this, context));
  }

  onOpenDatabase(context, connection) {
    if(!connection) {
      context.uploader.remove();
      context.callback();
      return;
    }

    console.debug('Connected to database');
    context.connection = connection;

    for(let file of context.files) {
      console.debug('Importing file', file.name);
      if(!this.isMimeTypeXML(file.type)) {
        console.warn('Invalid mime type', file.name, file.type);
        this.onFileProcessed(context);
        continue;
      }

      if(!file.size) {
        console.warn('Empty file', file.name);
        this.onFileProcessed(context);
        continue;
      }

      const reader = new FileReader();
      const boundOnFileRead = this.onFileRead.bind(this, context, file);
      reader.addEventListener('load', boundOnFileRead);
      reader.addEventListener('error', boundOnFileRead);
      reader.readAsText(file);
    }
  }

  isMimeTypeXML(typeString) {
    return typeString && typeString.toLowerCase().includes('xml');
  }

  onFileProcessed(context) {
    context.filesProcessed++;
    if(context.filesProcessed === context.files.length) {
      context.connection.close();
      context.uploader.remove();
      context.callback();
    }
  }

  onFileRead(context, file, event) {
    if(event.type === 'error') {
      console.warn(file.name, event);
      this.onFileProcessed(context);
      return;
    }

    const parser = new DOMParser();
    const fileText = event.target.result;
    let document = null;
    try {
      document = parser.parseFromString(fileText, 'application/xml');
    } catch(exception) {
      console.warn(exception);
      this.onFileProcessed(context);
      return;
    }

    if(!document) {
      console.warn('Undefined document', file.name);
      this.onFileProcessed(context);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.warn('Parse error', file.name, parserError.textContent);
      this.onFileProcessed(context);
      return;
    }

    if(document.documentElement.localName !== 'opml') {
      console.warn('Not <opml>', file.name, document.documentElement.nodeName);
      this.onFileProcessed(context);
      return;
    }

    // NOTE: for an unknown reason, document.body doesn't work here
    const bodyElement = document.querySelector('body');
    if(!bodyElement) {
      console.warn('No body element', file.name,
        document.documentElement.outerHTML);
      this.onFileProcessed(context);
      return;
    }

    const seenURLStringSet = new Set();
    const boundOnAddFeed = this.onAddFeed.bind(this, context);

    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {

      if(element.localName !== 'outline') {
        continue;
      }

      let type = element.getAttribute('type');
      if(!type || type.length < 3 || !/rss|rdf|feed/i.test(type)) {
        console.warn('Invalid outline type', element.outerHTML);
        continue;
      }

      const urlString = (element.getAttribute('xmlUrl') || '').trim();
      if(!urlString) {
        console.warn('Outline without url', element.outerHTML);
        continue;
      }

      let url = this.toURLTrapped(urlString);
      if(!url) {
        console.warn('Invalid outline url', element.outerHTML);
        continue;
      }

      if(seenURLStringSet.has(url.href)) {
        console.debug('Skipping duplicate outline', element.outerHTML);
        continue;
      }
      seenURLStringSet.add(url.href);

      // TODO: this should not be responsible for sanization. Defer that
      // to cache.addFeed. Because subscription.js also depends on addFeed
      // I need to make changes to all 3 at once.
      // TODO: in fact, this should be interacting with the subscription
      // service, unless i roll that into feed-cache

      // Create the feed object that will be stored
      const feed = {};
      feed.urls = [url.href];
      feed.type = type;
      feed.title = this.sanitizeString(element.getAttribute('title') ||
        element.getAttribute('text'));
      feed.description = this.sanitizeString(
        element.getAttribute('description'));

      // Not all feeds have an associated htmlUrl attribute
      const htmlUrlString = element.getAttribute('htmlUrl');
      if(htmlUrlString) {
        let outlineLinkURL = this.toURLTrapped(htmlUrlString);
        if(outlineLinkURL) {
          feed.link = outlineLinkURL.href;
        }
      }

      this.cache.addFeed(context.connection, feed, boundOnAddFeed);
    }

    this.onFileProcessed(context);
  }

  toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {
      console.warn(exception);
    }

    return null;
  }

  // TODO: this overlaps with poll functionality, should probably make a
  // general purpose function that is shared

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
      console.debug('Added feed id', event.target.result);
    } else {
      console.error('Add feed error', event);
    }
  }
}
