// OPML Outline utilities

// TODO: I have mixed feelings about the dependency on feed. Perhaps it should be the other way
// around, and feed should depend on this, and this should have no knowledge about feed format.

import assert from "/src/assert.js";
import * as Feed from "/src/feed.js";

function isOutline(outline) {
  return typeof outline === 'object';
}

export function toFeed(outline) {
  assert(isOutline(outline));

  const feed = {};
  if(outline.type) {
    feed.type = outline.type;
  }

  if(outline.title) {
    feed.title = outline.title;
  }

  if(outline.text) {
    feed.text = outline.text;
  }

  if(outline.description) {
    feed.description = outline.description;
  }

  if(outline.htmlUrl) {
    feed.link = outline.htmlUrl;
  }

  Feed.appendURL(feed, outline.xmlUrl);
  return feed;
}

export function fromFeed(feed) {
  assert(Feed.isFeed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = Feed.peekURL(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

export function elementHasValidType(element) {
  assert(element instanceof Element);
  const TYPE_PATTERN = /\s*(rss|rdf|feed)\s*/i;
  return TYPE_PATTERN.test(element.getAttribute('type'));
}

export function elementHasXMLURL(element) {
  const xmlUrl = element.getAttribute('xmlUrl');
  return xmlUrl && xmlUrl.trim();
}

export function elementNormalizeXMLURL(element) {
  let url = element.getAttribute('xmlUrl');
  if(url) {
    try {
      const urlObject = new URL(url);
      element.setAttribute('xmlUrl', urlObject.href);
    } catch(error) {
      element.removeAttribute('xmlUrl');
    }
  }
}

export function normalizeHTMLURL(outline) {
  assert(isOutline(outline));

  if(outline.htmlUrl === undefined) {
    return;
  }

  // Setting to undefined is preferred over deleting in order to
  // maintain v8 object shape
  if(outline.htmlUrl === null) {
    outline.htmlUrl = undefined;
    return;
  }

  if(outline.htmlUrl === '') {
    outline.htmlUrl = undefined;
    return;
  }

  try {
    const urlObject = new URL(outline.htmlUrl);
    outline.htmlUrl = urlObject.href;
  } catch(error) {
    outline.htmlUrl = undefined;
  }
}

export function toElement(doc, outline) {
  assert(doc instanceof Document);
  assert(isOutline(outline));

  const element = doc.createElement('outline');
  if(outline.type) {
    element.setAttribute('type', outline.type);
  }

  if(outline.xmlUrl) {
    element.setAttribute('xmlUrl', outline.xmlUrl);
  }

  if(outline.text) {
    element.setAttribute('text', outline.text);
  }

  if(outline.title) {
    element.setAttribute('title', outline.title);
  }

  if(outline.description) {
    element.setAttribute('description', outline.description);
  }

  if(outline.htmlUrl) {
    element.setAttribute('htmlUrl', outline.htmlUrl);
  }

  return element;
}

export function fromElement(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
