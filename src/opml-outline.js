
import assert from "/src/assert.js";
import {feedAppendURL, feedIsFeed, feedPeekURL} from "/src/feed.js";

// TODO: create OPMLOutline?
// TODO: deprecate in favor of caller using instanceof?
function opmlOutlineIsOutline(outline) {
  return typeof outline === 'object';
}

export function opmlOutlineToFeed(outline) {
  assert(opmlOutlineIsOutline(outline));

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

  feedAppendURL(feed, outline.xmlUrl);
  return feed;
}

export function opmlOutlineFromFeed(feed) {
  assert(feedIsFeed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feedPeekURL(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

export function opmlOutlineElementHasValidType(element) {
  assert(element instanceof Element);
  const TYPE_PATTERN = /\s*(rss|rdf|feed)\s*/i;
  return TYPE_PATTERN.test(element.getAttribute('type'));
}

export function opmlOutlineElementHasXMLURL(element) {
  let xmlUrl = element.getAttribute('xmlUrl');
  return xmlUrl && xmlUrl.trim();
}

export function opmlOutlineElementNormalizeXMLURL(element) {
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

export function opmlOutlineNormalizeHTMLURL(outline) {
  assert(opmlOutlineIsOutline(outline));

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

export function opmlOutlineToElement(doc, outline) {
  assert(doc instanceof Document);
  assert(opmlOutlineIsOutline(outline));

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

export function opmlOutlineElementToObject(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
