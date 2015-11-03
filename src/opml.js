// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function importOPML(files, callback) {
  async.map(files, loadFile, onFilesLoaded);

  function loadFile(file, callback) {
    const reader = new FileReader();
    reader.onload = onFileLoad.bind(reader, callback);
    reader.onerror = function(event) {
      callback(null, []);
    };
    reader.readAsText(file);
  }

  function isValidOPMLDocument(document) {
    return document && document.documentElement && 
      document.documentElement.matches('opml') &&
      !document.querySelector('parsererror');
  }

  const TYPE_PATTERN = /rss|rdf|feed/i;
  function isValidOutlineElement(element) {
    const type = element.getAttribute('type');
    const url = element.getAttribute('xmlUrl') || '';
    return TYPE_PATTERN.test(type) && url.trim();
  }

  function createOutlineFromElement(element) {
    const outline = {};
    let title = element.getAttribute('title') || '';
    title = title.trim();
    if(!title) {
      title = element.getAttribute('text') || '';
      title = title.trim();
    }

    title = stripControlCharacters(title);
    if(title) {
      outline.title = title;
    }
    let description = element.getAttribute('description');
    description = stripControlCharacters(description);
    description = stripTags(description);
    description = description.trim();
    if(description) {
      outline.description = description;
    }
    let url = element.getAttribute('xmlUrl') || '';
    url = stripControlCharacters(url);
    url = url.trim();
    if(url) {
      outline.url = url;
    }
    let link = element.getAttribute('htmlUrl') || '';
    link = stripControlCharacters(link);
    link = link.trim();
    if(link) {
      outline.link = link;
    }
    return outline;
  }

  function onFileLoad(callback, event) {
    const reader = event.target;
    const text = reader.result;
    const xmlParser = new DOMParser();
    const xml = xmlParser.parseFromString(text, 'application/xml');
    if(!isValidOPMLDocument(xml)) {
      callback(null, []);
      return;
    }
    const elements = xml.getElementsByTagName('outline');
    const outlines = Array.prototype.filter.call(elements, 
      isValidOutlineElement).map(createOutlineFromElement);
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

    openDatabaseConnection(function(event) {
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
      putFeed(connection, null, outline, callback);
    }, onImportComplete);
  }

  function onImportComplete(error) {
    // console.debug('Finished importing feeds');
    const notification = 'Completed importing file(s)';
    showNotification(notification);  
    callback();
  }
}

function exportOPML(title, callback) {
  const feeds = [];
  openDatabaseConnection(function(event){
    if(event.type !== 'success') {
      callback(event);
      return;
    }

    forEachFeed(event.target.result, processFeed, false, onFeedsEnumerated);
  });

  function processFeed(feed) {
    feeds.push(feed);
  }

  function onFeedsEnumerated() {
    const document = createOPMLDocument(feeds, title);
    const writer = new XMLSerializer();
    const opml = writer.serializeToString(document);
    const blob = new Blob([opml], {type: 'application/xml'});
    callback(null, blob);
  }

  function createOPMLDocument(feeds, title) {
    const doc = document.implementation.createDocument(null, null);
    const opml = doc.createElement('opml');
    opml.setAttribute('version', '2.0');
    doc.appendChild(opml);
    const head = doc.createElement('head');
    opml.appendChild(head);
    const titleElement = doc.createElement('title');
    titleElement.textContent = title;
    head.appendChild(titleElement);
    const nowString = (new Date()).toUTCString();
    const dateCreated = doc.createElement('dateCreated');
    dateCreated.textContent = nowString;
    head.appendChild(dateCreated);
    const dateModified = doc.createElement('dateModified');
    dateModified.textContent = nowString;
    head.appendChild(dateModified);
    const docs = doc.createElement('docs');
    docs.textContent = 'http://dev.opml.org/spec2.html';
    head.appendChild(docs);
    if(!feeds) {
      return doc;
    }
    const exportables = feeds.filter(function(feed) {
      return feed.url;
    });
    if(!exportables.length) {
      return doc;
    }
    const body = doc.createElement('body');
    opml.appendChild(body);
    const outlines = exportables.map(createOutline.bind(null, doc));
    outlines.forEach(function(outline) {
      body.appendChild(outline);
    });
    return doc;
  }

  function createOutline(document, feed) {
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
}
