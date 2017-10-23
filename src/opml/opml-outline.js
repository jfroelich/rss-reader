'use strict';

// import rss/feed.js

function opml_outline_is_outline(outline) {
  return typeof outline === 'object';
}

function opml_outline_to_feed(outline) {
  console.assert(opml_outline_is_outline(outline));

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

function opml_outline_from_feed(feed) {
  console.assert(feed_is_feed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feed_get_top_url(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

function opml_outline_element_has_valid_type(element) {
  console.assert(element instanceof Element);
  const TYPE_PATTERN = /\s*(rss|rdf|feed)\s*/i;
  return TYPE_PATTERN.test(element.getAttribute('type'));
}

function opml_outline_element_has_xmlurl(element) {
  let xml_url = element.getAttribute('xmlUrl');
  return xml_url && xml_url.trim();
}

function opml_outline_element_normalize_xmlurl(element) {
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

function opml_outline_normalize_htmlurl(outline) {
  console.assert(opml_outline_is_outline(outline));

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

function opml_outline_to_element(doc, outline) {
  console.assert(doc instanceof Document);
  console.assert(opml_outline_is_outline(outline));

  const element = doc.createElement('outline');
  if(outline.type)
    element.setAttribute('type', outline.type);
  if(outline.xmlUrl)
    element.setAttribute('xmlUrl', outline.xmlUrl);
  if(outline.text)
    element.setAttribute('text', outline.text);
  if(outline.title)
    element.setAttribute('title', outline.title);
  if(outline.description)
    element.setAttribute('description', outline.description);
  if(outline.htmlUrl)
    element.setAttribute('htmlUrl', outline.htmlUrl);
  return element;
}

function opml_outline_element_to_object(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
