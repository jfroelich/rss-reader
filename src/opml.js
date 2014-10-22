// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

(function(exports) {

'use strict';

/**
 * Generates an OPML XMLDocument object. feeds should be
 * an array of feed objects. feed objects should have properties
 * title, url, description, and link. url is the only required
 * property. titleElementValue is optional.
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

  if(!feeds) {
    return opmlDocument;
  }

  var feedsWithURLs = feeds.filter(function hasURL(feed) {
    return feed.url;
  });

  if(!feedsWithURLs.length) {
    return opmlDocument;
  }

  var bodyElement = opmlDocument.createElement('body');
  elementOPML.appendChild(bodyElement);

  var createOutline = createOutlineElement.bind(this, opmlDocument);

  feedsWithURLs.map(createOutline).forEach(function (element) {
    bodyElement.appendChild(element);
  });

  return opmlDocument;
}


function createOutlineElement(doc, feed) {
  var element = doc.createElement('outline');

  // NOTE: this makes a major assumption about each feed's
  // format. We do not track the format from the time the
  // feed was imported so there is no way to know. This is
  // only marginal though because I assume most reader apps
  // do not rely on this type to determine the format.
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
}

// Build and return a feed object with properties
// title, description, url, and link
function createOutlineObject(element) {


  var outline = {};
  var title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }

  title = lucu.stripControls(title);

  if(title) {
    outline.title = title;
  }

  var description = element.getAttribute('description');
  description = lucu.stripControls(description);
  description = lucu.stripTags(description);
  description = description.trim();

  if(description) {
    outline.description = description;
  }

  var url = element.getAttribute('xmlUrl') || '';
  url = lucu.stripControls(url);
  url = url.trim();

  if(url) {
    outline.url = url;
  }

  var link = element.getAttribute('htmlUrl') || '';
  link = lucu.stripControls(link);
  link = link.trim();

  if(link) {
    outline.link = link;
  }

  return outline;
}

/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 */
function createOutlines(doc) {

  if(!doc || !doc.documentElement || !doc.documentElement.matches('opml')) {
    return [];
  }

  var filter = Array.prototype.filter;
  var outlineElements = doc.getElementsByTagName('outline');
  var validOutlines = filter.call(outlineElements, function (element) {
    var type = element.getAttribute('type');
    var url = element.getAttribute('xmlUrl') || '';
    return /rss|rdf|feed/i.test(type) && url.trim();
  });

  return validOutlines.map(createOutlineObject);
}

exports.lucu = exports.lucu || {};
exports.lucu.opml = {
  createDocument: createDocument,
  createOutlines: createOutlines
};

}(this));
