// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property.
 */
lucu.createOPMLDocument = function(feeds, title) {
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

  var outlines = exportables.map(function (feed) {
    var outline = doc.createElement('outline');
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
  });

  outlines.forEach(function (element) {
    body.appendChild(element);
  });

  return doc;
};


/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 *
 * TODO: explicit dependence on lucu.stripControls and lucu.stripTags?
 * TODO: guard against duplicates?
 */
lucu.createOPMLOutlines = function(doc) {
  if(!doc || !doc.documentElement || !doc.documentElement.matches('opml'))
    return [];
  var filter = Array.prototype.filter;
  // TODO: shouldn't this be doc.documentElement.get...?
  var outlineElements = doc.getElementsByTagName('outline');
  return filter.call(outlineElements, function (element) {
    var type = element.getAttribute('type');
    var url = element.getAttribute('xmlUrl') || '';
    return /rss|rdf|feed/i.test(type) && url.trim();
  }).map(function (element) {
    var outline = {};
    var title = element.getAttribute('title') || '';
    title = title.trim();
    if(!title) {
      title = element.getAttribute('text') || '';
      title = title.trim();
    }
    title = lucu.stripControls(title);
    if(title)
      outline.title = title;
    var description = element.getAttribute('description');
    description = lucu.stripControls(description);
    description = lucu.stripTags(description);
    description = description.trim();
    if(description)
      outline.description = description;
    var url = element.getAttribute('xmlUrl') || '';
    url = lucu.stripControls(url);
    url = url.trim();
    if(url)
      outline.url = url;
    var link = element.getAttribute('htmlUrl') || '';
    link = lucu.stripControls(link);
    link = link.trim();
    if(link)
      outline.link = link;
    return outline;
  });
};
