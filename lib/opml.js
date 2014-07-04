// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
/**
 * Generates an OPML XMLDocument object. feeds should be
 * an array of feed objects. feed objects should have properties
 * title, url, description, and link. url is the only required
 * property. titleElementValue is optional.
 */
function createOPMLDocument(feeds, titleElementValue) {

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

  if(!feeds || !feeds.length) {
    return opmlDocument;
  }

  // It is not necessary to filter url-less feeds here because all
  // feeds that exist in the database are known to have urls. I
  // suppose this is harmless enough to leave in here for now.

  var feedsWithURLs = feeds.filter(function(feed) {
    return feed.url;
  });

  if(!feedsWithURLs.length) {
    return opmlDocument;
  }

  var bodyElement = opmlDocument.createElement('body');
  elementOPML.appendChild(bodyElement);

  // Create outline elements and append them to the bodyElement
  feedsWithURLs.map(function(feed) {
    var outlineElement = opmlDocument.createElement('outline');

    // NOTE: this makes a major assumption about each feed's
    // format. We do not track the format from the time the
    // feed was imported so there is no way to know. This is
    // only marginal though because I assume most reader apps
    // do not rely on this type to determine the format.
    outlineElement.setAttribute('type', 'rss');

    // Fallback to using url as title if it is missing
    var title = feed.title || feed.url;
    outlineElement.setAttribute('text', title);
    outlineElement.setAttribute('title', title);

    outlineElement.setAttribute('xmlUrl', feed.url);

    if(feed.description) {
      outlineElement.setAttribute('description', feed.description);
    }

    if(feed.link) {
      outlineElement.setAttribute('htmlUrl', feed.link);
    }

    return outlineElement;
  }).forEach(function(outlineElement) {
    bodyElement.appendChild(outlineElement);
  });

  return opmlDocument;
}

/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 */
function createOutlinesFromOPMLDocument(xmlDocument) {

  // Create an array-like list of outline elements or an empty array
  // depending on whether the document looks like an opml document
  var outlineElements = xmlDocument && xmlDocument.documentElement &&
    xmlDocument.documentElement.matches('opml') ?
    xmlDocument.getElementsByTagName('outline') : [];

  // Filter out outlines that are not one of the supported types or
  // are missing urls, then create outline objects for each outline
  // element and return the resulting array.
  return Array.prototype.filter.call(outlineElements, function(outlineElement) {
    return /rss|rdf|feed/i.test(outlineElement.getAttribute('type')) &&
      (outlineElement.getAttribute('xmlUrl') || '').trim();
  }).map(function(element) {

    // Build and return a feed object with properties
    // title, description, url, and link

    var outline = {};
    var title = element.getAttribute('title') || '';
    title = title.trim();
    if(!title) {
      title = element.getAttribute('text') || '';
      title = title.trim();
    }

    title = stripControls(title);

    if(title) {
      outline.title = title;
    }

    var description = element.getAttribute('description');
    description = stripControls(description);
    description = stripTags(description);
    description = description.trim();

    if(description) {
      outline.description = description;
    }

    var url = element.getAttribute('xmlUrl') || '';
    url = stripControls(url);
    url = url.trim();

    if(url) {
      outline.url = url;
    }

    var link = element.getAttribute('htmlUrl') || '';
    link = stripControls(link);
    link = link.trim();

    if(link) {
      outline.link = link;
    }

    return outline;
  });
}