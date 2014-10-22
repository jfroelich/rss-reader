// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * OPML module that provides methods for marshalling to and unmarshalling
 * from OPML documents.
 *
 * TODO: explicit dependence on lucu.stripControls and lucu.stripTags
 */
(function(exports) {
'use strict';

/**
 * Generates an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property. TitleElementValue is optional
 * string argument.
 */
function createDocument(feeds, titleElementValue) {
  var opmlDocument = document.implementation.createDocument(null, null);
  var elementOPML = opmlDocument.createElement('opml');
  elementOPML.setAttribute('version', '2.0');
  opmlDocument.appendChild(elementOPML);
  var head = opmlDocument.createElement('head');
  elementOPML.appendChild(head);
  var title = opmlDocument.createElement('title');
  title.textContent = titleElementValue || 'subscriptions.xml';
  head.appendChild(title);
  var dateNow = new Date();
  var rfc822DateString = dateNow.toUTCString();
  var dateCreated = opmlDocument.createElement('dateCreated');
  dateCreated.textContent = rfc822DateString;
  head.appendChild(dateCreated);
  var dateModified = opmlDocument.createElement('dateModified');
  dateModified.textContent = rfc822DateString;
  head.appendChild(dateModified);
  var elementDocs = opmlDocument.createElement('docs');
  elementDocs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(elementDocs);
  if(!feeds)
    return opmlDocument;
  var exportableFeeds = feeds.filter(function isExportable(feed) {
    return feed.url;
  });
  if(!exportableFeeds.length)
    return opmlDocument;

  var bodyElement = opmlDocument.createElement('body');
  elementOPML.appendChild(bodyElement);

  var outlineElements = exportableFeeds.map(function (feed) {
    var element = opmlDocument.createElement('outline');
    // The app does not track the original format because it is not persisted
    // when the feed is first obtained. Therefore, we provide a default type
    // "rss", which could be wrong. However, I assume most other feed parsers
    // determine the format of an XML feed file from the XML document element
    // and not from here, so I don't think it causes too much of an issue. So
    // I am just noting how this is not 100% correct.
    element.setAttribute('type', 'rss');
    var title = feed.title || feed.url;
    element.setAttribute('text', title);
    element.setAttribute('title', title);
    element.setAttribute('xmlUrl', feed.url);
    if(feed.description)
      element.setAttribute('description', feed.description);
    if(feed.link)
      element.setAttribute('htmlUrl', feed.link);
    return element;
  });

  outlineElements.forEach(function (element) {
    bodyElement.appendChild(element);
  });

  return opmlDocument;
}

/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 *
 * TODO: guard against duplicates?
 */
function createOutlines(doc) {
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
}

exports.lucu = exports.lucu || {};
exports.lucu.opml = {
  createDocument: createDocument,
  createOutlines: createOutlines
};

}(this));
