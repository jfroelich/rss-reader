// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class OPML {

  static parseXML(string) {
    const parser = new DOMParser();
    const document = parser.parseFromString(string, OPML.MIME_TYPE);
    return document;
  }

  static importFiles(files, callback) {
    async.map(files, loadFile, onFilesLoaded);

    function loadFile(file, callback) {
      const reader = new FileReader();
      reader.onload = onFileLoad.bind(reader, callback);
      reader.onerror = function(event) {
        callback(null, []);
      };
      reader.readAsText(file);
    }

    function onFileLoad(callback, event) {
      const reader = event.target;
      const text = reader.result;
      const document = OPML.parseXML(text);
      if(!OPML.isValidDocument(document)) {
        callback(null, []);
        return;
      }
      const elements = document.getElementsByTagName('outline');
      const outlines = Array.prototype.filter.call(elements, 
        OPML.isValidOutline).map(OPML.createOutline);
      callback(null, outlines);
    }

    function onFilesLoaded(error, outlineArrays) {
      // TODO: use the new ... operator to simplify this,
      // or maybe just create a Set object
      const outlines = [];
      const seen = new Set();
      outlineArrays.forEach(function(outlineArray) {
        outlineArray.foreach(function(outline) {
          if(seen.has(outline.url)) return;
          seen.add(outline.url);
          outlines.push(outline);
        });
      });

      Database.open(function(event) {
        if(event.type !== 'success') {
          console.debug(event);
          onImportComplete(event);
          return;
        }

        storeOutlines(event.target.result, outlines);
      });
    }

    function storeOutlines(connection, outlines) {
      async.forEach(outlines, function(outline, callback) {
        Feed.put(connection, null, outline, callback);
      }, onImportComplete);
    }

    function onImportComplete(error) {
      const message = 'Imported OPML file(s)';
      Notification.show(message);  
      callback();
    }
  }

  static isValidDocument(document) {
    return document && document.documentElement && 
      document.documentElement.matches('opml') &&
      !document.querySelector('parsererror');
  }

  static isValidOutline(element) {
    const TYPE_PATTERN = /rss|rdf|feed/i;
    const type = element.getAttribute('type');
    const url = element.getAttribute('xmlUrl') || '';
    return TYPE_PATTERN.test(type) && url.trim();
  }

  static createOutline(element) {
    const outline = {};

    let title = element.getAttribute('title') || '';
    title = title.trim();
    if(!title) {
      title = element.getAttribute('text') || '';
      title = title.trim();
    }
    title = StringUtils.stripControlCharacters(title);
    if(title) {
      outline.title = title;
    }

    let description = element.getAttribute('description');
    description = StringUtils.stripControlCharacters(description);
    description = StringUtils.stripTags(description);
    description = description.trim();
    if(description) {
      outline.description = description;
    }

    let url = element.getAttribute('xmlUrl') || '';
    url = StringUtils.stripControlCharacters(url);
    url = url.trim();
    if(url) {
      outline.url = url;
    }

    let link = element.getAttribute('htmlUrl') || '';
    link = StringUtils.stripControlCharacters(link);
    link = link.trim();
    if(link) {
      outline.link = link;
    }
    return outline;
  }

  static exportFile(title, callback) {
    const feeds = [];
    Database.open(function(event){
      if(event.type !== 'success') {
        callback(event);
        return;
      }

      Feed.forEach(event.target.result, processFeed, false, onFeedsEnumerated);
    });

    function processFeed(feed) {
      feeds.push(feed);
    }

    function onFeedsEnumerated() {
      const document = OPML.createDocument(feeds, title);
      const writer = new XMLSerializer();
      const opml = writer.serializeToString(document);
      const blob = new Blob([opml], {type: OPML.MIME_TYPE});
      callback(null, blob);
    }
  }

  function createOutlineElement(document, feed) {
    const outline = document.createElement('outline');
    // We do not know the original format, so default to rss
    outline.setAttribute('type', 'rss');
    outline.setAttribute('xmlUrl', feed.url);
    if(feed.title) {
      outline.setAttribute('text', feed.title);
      outline.setAttribute('title', feed.title);
    }
    if(feed.description) {
      outline.setAttribute('description', feed.description);
    }
    if(feed.link) {
      outline.setAttribute('htmlUrl', feed.link);
    }
    return outline;
  }

  static createDocument(feeds, title) {
    const document = document.implementation.createDocument(null, null);
    const opml = document.createElement('opml');
    opml.setAttribute('version', '2.0');
    document.appendChild(opml);
    const head = document.createElement('head');
    opml.appendChild(head);
    const titleElement = document.createElement('title');
    titleElement.textContent = title;
    head.appendChild(titleElement);
    const nowString = (new Date()).toUTCString();
    const dateCreated = document.createElement('dateCreated');
    dateCreated.textContent = nowString;
    head.appendChild(dateCreated);
    const dateModified = document.createElement('dateModified');
    dateModified.textContent = nowString;
    head.appendChild(dateModified);
    const docs = document.createElement('docs');
    docs.textContent = 'http://dev.opml.org/spec2.html';
    head.appendChild(docs);
    if(!feeds) {
      return document;
    }
    const exportables = feeds.filter(function(feed) {
      return feed.url;
    });
    if(!exportables.length) {
      return document;
    }
    const body = document.createElement('body');
    opml.appendChild(body);
    const outlines = exportables.map(
      OPML.createOutlineElement.bind(null, document));
    outlines.forEach(function(outline) {
      body.appendChild(outline);
    });
    return document;
  }
}

OPML.MIME_TYPE = 'application/xml';
