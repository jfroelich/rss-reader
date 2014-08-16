// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.opml = {};

/**
 * Generates an OPML XMLDocument object. feeds should be
 * an array of feed objects. feed objects should have properties
 * title, url, description, and link. url is the only required
 * property. titleElementValue is optional.
 */
lucu.opml.createDocument = function(feeds, titleElementValue) {

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

  var feedsWithURLs = feeds.filter(lucu.feed.hasURL);

  if(!feedsWithURLs.length) {
    return opmlDocument;
  }

  var bodyElement = opmlDocument.createElement('body');
  elementOPML.appendChild(bodyElement);

  var boundCOE = lucu.opml.createOutlineElement.bind(this, opmlDocument);

  // TODO: use something like Element.prototype.appendChild.bind
  var boundAOTB = lucu.opml.appendOutlineToBody.bind(this, bodyElement);

  feedsWithURLs.map(boundCOE).forEach(boundAOTB);

  return opmlDocument;
};

// TODO: deprecate, use Element.prototype.appendChild
lucu.opml.appendOutlineToBody = function(bodyElement, element) {
  bodyElement.appendChild(element);
};

lucu.opml.createOutlineElement = function(doc, feed) {
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
};

lucu.opml.createOutlineObject = function(element) {
  // Build and return a feed object with properties
  // title, description, url, and link

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
};

lucu.opml.isValidOutlineElement = function(element) {
  var type = element.getAttribute('type');
  var url = element.getAttribute('xmlUrl') || '';
  return /rss|rdf|feed/i.test(type) && url.trim();
};

lucu.opml.isValidDocument = function(doc) {
  return doc && doc.documentElement && doc.documentElement.matches('opml');
};

// Generates an array of outline objects from an OPML XMLDocument object.
lucu.opml.createOutlines = function(doc) {
  var filter = Array.prototype.filter;
  var isOutline = lucu.opml.isValidOutlineElement;
  var asObject = lucu.opml.createOutlineObject;
  var isValid = lucu.opml.isValidDocument(doc);
  var elements = isValid ? doc.getElementsByTagName('outline') : [];
  return filter.call(elements, isOutline).map(asObject);
};
