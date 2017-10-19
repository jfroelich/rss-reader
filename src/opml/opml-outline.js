'use strict';

// import base/assert.js
// import rss/feed.js

function outline_to_feed(outline) {
  const feed = {};
  if(outline.type)
    feed.type = outline.type;
  if(outline.title)
    feed.title = outline.title;
  if(outline.text)
    feed.text = outline.text;
  if(outline.description)
    feed.description = outline.description;
  if(outline.htmlUrl)
    feed.link = outline.htmlUrl;
  feed_append_url(feed, outline.xmlUrl);
  return feed;
}

function outline_from_feed(feed) {
  ASSERT(feed);
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feed_get_top_url(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

function outline_element_has_valid_type(element) {
  let type = element.getAttribute('type');
  if(type) {
    type = type.trim();
    if(type) {
      return /rss|rdf|feed/i.test(type);
    }
  }

  return false;
}

function outline_element_has_xmlurl(element) {
  let xml_url = element.getAttribute('xmlUrl');
  return xml_url && xml_url.trim();
}

function outline_element_normalize_xmlurl(element) {
  let url = element.getAttribute('xmlUrl');
  if(url) {
    try {
      const urlo = new URL(url);
      element.setAttribute('xmlUrl', urlo.href);
    } catch(error) {
      element.removeAttribute('xmlUrl');
    }
  }
}

function outline_normalize_htmlurl(outline) {
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
    const urlo = new URL(outline.htmlUrl);
    outline.htmlUrl = urlo.href;
  } catch(error) {
    outline.htmlUrl = undefined;
  }
}

function outline_to_element(doc, object) {
  ASSERT(doc);

  const element = doc.createElement('outline');
  if(object.type)
    element.setAttribute('type', object.type);
  if(object.xmlUrl)
    element.setAttribute('xmlUrl', object.xmlUrl);
  if(object.text)
    element.setAttribute('text', object.text);
  if(object.title)
    element.setAttribute('title', object.title);
  if(object.description)
    element.setAttribute('description', object.description);
  if(object.htmlUrl)
    element.setAttribute('htmlUrl', object.htmlUrl);
  return element;
}

function outline_element_to_object(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
