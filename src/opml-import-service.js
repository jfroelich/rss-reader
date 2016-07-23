// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: unfinished refactoring

class OPMLImportService {

  constructor() {
    this.log = new LoggingService();
    this.cache = new FeedCache();
  }

  start(callback) {
    this.log.debug('OPMLImportService: starting import');
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
    this.log.debug('OPMLImportService: received files');
    context.uploader.removeEventListener('change', this.onUploaderChange);
    context.files = context.uploader.files;
    if(!context.files || !context.files.length) {
      this.log.debug('OPMLImportService: no files found');
      context.uploader.remove();
      context.callback();
      return;
    }

    this.cache.open(this.onOpenDatabase.bind(this, context));
  }

  onOpenDatabase(context, event) {
    if(event.type !== 'success') {
      this.log.error(event);
      context.uploader.remove();
      context.callback();
      return;
    }

    this.log.debug('OPMLImportService: connected to database');
    context.connection = event.target.result;

    for(let file of context.files) {
      this.log.debug('OPMLImportService: processing', file.name);
      if(!this.isMimeTypeXML(file.type)) {
        this.log.debug('OPMLImportService: skipping file due to mime type',
          file.name, file.type);
        this.onFileProcessed(context);
        continue;
      }

      if(!file.size) {
        this.log.debug('OPMLImportService: skipping 0 sized file', file.name);
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
    return typeString.toLowerCase().includes('xml');
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
      this.log.error(file.name, event);
      this.onFileProcessed(context);
      return;
    }

    this.log.debug('OPMLImportService: parsing', file.name);

    const parser = new DOMParser();
    const fileText = event.target.result;
    let document = null;
    try {
      document = parser.parseFromString(fileText, 'application/xml');
    } catch(exception) {
      this.log.error(exception);
      this.onFileProcessed(context);
      return;
    }

    if(!document) {
      this.log.error('OPMLImportService: undefined document',
        file.name);
      this.onFileProcessed(context);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      this.log.error('OPMLImportService: parse error', file.name,
        parserError.textContent);
      this.onFileProcessed(context);
      return;
    }

    if(document.documentElement.localName !== 'opml') {
      this.log.debug('OPMLImportService: not opml', file.name,
        document.documentElement.nodeName);
      this.onFileProcessed(context);
      return;
    }

    // NOTE: for an unknown reason, document.body doesn't work here
    const bodyElement = document.querySelector('body');
    if(!bodyElement) {
      this.log.debug('OPMLImportService: no body element', file.name,
        document.documentElement.outerHTML);
      this.onFileProcessed(context);
      return;
    }

    const seenURLStringSet = new Set();
    const boundOnAddFeed = this.onAddFeed.bind(this, context);

    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {

      if(element.localName !== 'outline') {
        this.log.debug('OPMLImportService: skipping non outline element',
          element.outerHTML);
        continue;
      }

      let type = element.getAttribute('type');
      if(!type || type.length < 3 || !/rss|rdf|feed/i.test(type)) {
        this.log.debug('OPMLImportService: skipping outline with type', type);
        continue;
      }

      const urlString = (element.getAttribute('xmlUrl') || '').trim();
      if(!urlString) {
        this.log.debug('OPMLImportService: skipping outline without url',
          urlString);
        continue;
      }

      let url = this.toURLTrapped(urlString);
      if(!url) {
        this.log.debug('OPMLImportService: skipping outline due to url error',
          element.getAttribute('xmlUrl'));
        continue;
      }

      if(seenURLStringSet.has(url.href)) {
        this.log.debug('OPMLImportService: skipping duplicate outline',
          url.href);
        continue;
      }
      seenURLStringSet.add(url.href);

      // Create the feed object that will be stored
      const feed = {};
      feed.urls = [url.href];
      feed.type = type;
      feed.title = this.sanitizeString(element.getAttribute('title') ||
        element.getAttribute('text'));
      feed.description = this.sanitizeString(
        element.getAttribute('description'));

      // NOTE: not all feeds have an associated htmlUrl attribute
      const htmlUrlString = element.getAttribute('htmlUrl');
      if(htmlUrlString) {
        let outlineLinkURL = this.toURLTrapped(htmlUrlString);
        if(outlineLinkURL) {
          feed.link = outlineLinkURL.href;
        }
      }

      this.log.debug('OPMLImportService: adding feed', url.href);
      this.cache.addFeed(context.connection, feed, boundOnAddFeed);
    }

    this.onFileProcessed(context);
  }

  toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {
      this.log.debug('OPMLImportService:', urlString, exception.message);
    }

    return null;
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
      this.log.debug('OPMLImportService: added feed id',
        event.target.result);
    } else {
      this.log.error('OPMLImportService: add feed error', event);
    }
  }
}
