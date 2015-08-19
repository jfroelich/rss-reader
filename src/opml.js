// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

/**
 * Returns an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property.
 */
lucu.opml.createDocument = function(feeds, title) {
  'use strict';
  var doc = document.implementation.createDocument(null, null);
  var opml = doc.createElement('opml');
  opml.setAttribute('version', '2.0');
  doc.appendChild(opml);
  var head = doc.createElement('head');
  opml.appendChild(head);
  var titleElement = doc.createElement('title');
  titleElement.textContent = title || 'subscriptions.xml';
  head.appendChild(titleElement);
  var nowString = (new Date()).toUTCString();
  var dateCreated = doc.createElement('dateCreated');
  dateCreated.textContent = nowString;
  head.appendChild(dateCreated);
  var dateModified = doc.createElement('dateModified');
  dateModified.textContent = nowString;
  head.appendChild(dateModified);
  var docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);
  if(!feeds) return doc;
  var exportables = feeds.filter(function (feed) {
    return feed.url;
  });
  if(!exportables.length) return doc;
  var body = doc.createElement('body');
  opml.appendChild(body);

  // TODO: test, pretty sure the null is the context, the doc
  // is the partial first arg
  var createOutline = lucu.opml.createOutlineElement.bind(null, doc);

  var appendOutlineElement = function(element) {
    body.appendChild(element);
  };

  exportables.map(createOutline).forEach(appendOutlineElement);

  return doc;
};

lucu.opml.createOutlineElement = function(document, feed) {
  var outline = document.createElement('outline');
  
  // We do not know the original format, so default to rss
  outline.setAttribute('type', 'rss');
  
  var title = feed.title || feed.url;
  outline.setAttribute('text', title);
  outline.setAttribute('title', title);
  outline.setAttribute('xmlUrl', feed.url);
  if(feed.description)
    outline.setAttribute('description', feed.description);
  if(feed.link)
    outline.setAttribute('htmlUrl', feed.link);
  return outline;  
};

/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 *
 * TODO: explicit dependence on lucu.string.stripControls and 
 * lucu.string.stripTags?
 * TODO: guard against duplicates?
 */
lucu.opml.createOutlines = function(document) {
  'use strict';

  var filter = Array.prototype.filter;
  var isValid = lucu.opml.outlineElementIsValid;
  var createOutline = lucu.opml.createOutlineFromElement;
  
  if(!lucu.opml.isOPMLDocument(document)) {
    return [];
  }

  // TODO: document.documentElement.get...?
  var outlineElements = document.getElementsByTagName('outline');
  var validElements = filter.call(outlineElements, isValid);
  return validElements.map(createOutline);
};

lucu.opml.isOPMLDocument = function(document) {
  return document && document.documentElement && 
    document.documentElement.matches('opml');
};

lucu.opml.outlineElementIsValid = function(element) {
  var type = element.getAttribute('type');
  var url = element.getAttribute('xmlUrl') || '';
  return /rss|rdf|feed/i.test(type) && url.trim();  
};

lucu.opml.createOutlineFromElement = function(element) {
  var outline = {};
  var title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }

  title = lucu.string.stripControls(title);
  if(title) outline.title = title;

  var description = element.getAttribute('description');
  description = lucu.string.stripControls(description);
  description = lucu.string.stripTags(description);
  description = description.trim();
  if(description) outline.description = description;

  var url = element.getAttribute('xmlUrl') || '';
  url = lucu.string.stripControls(url);
  url = url.trim();
  if(url) outline.url = url;

  var link = element.getAttribute('htmlUrl') || '';
  link = lucu.string.stripControls(link);
  link = link.trim();
  if(link) outline.link = link;

  return outline;
};
