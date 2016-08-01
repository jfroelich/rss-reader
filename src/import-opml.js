// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class OPMLImportService {

  constructor() {
  }

  start(callback) {
    console.debug('Importing OPML files...');

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

    openIndexedDB(this.onOpenDatabase.bind(this, context));
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
      console.debug('Reading file', file.name);
      if(!this.isMimeTypeXML(file.type)) {
        console.warn('Invalid mime type', file.name, file.type);
        this.onFileProcessed(context);
        continue;
      }

      if(!file.size) {
        console.warn('The file %s is empty', file.name);
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
      console.warn('Reading file %s resulted in undefined document', file.name);
      this.onFileProcessed(context);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.warn('XML parsing error', file.name, parserError.textContent);
      this.onFileProcessed(context);
      return;
    }

    if(document.documentElement.localName !== 'opml') {
      console.warn('Not <opml>', file.name, document.documentElement.nodeName);
      this.onFileProcessed(context);
      return;
    }

    const bodyElement = document.querySelector('body');
    if(!bodyElement) {
      console.warn('No body element', file.name,
        document.documentElement.outerHTML);
      this.onFileProcessed(context);
      return;
    }

    const seenURLStringSet = new Set();

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

      // Create the feed object to pass to addFeed
      const feed = {};
      feed.urls = [url.href];
      feed.type = type;
      feed.title = element.getAttribute('title') ||
        element.getAttribute('text');
      feed.description = element.getAttribute('description');

      const htmlUrlString = element.getAttribute('htmlUrl');
      if(htmlUrlString) {
        let outlineLinkURL = this.toURLTrapped(htmlUrlString);
        if(outlineLinkURL) {
          feed.link = outlineLinkURL.href;
        }
      }

      addFeed(context.connection, feed, null);
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
}
