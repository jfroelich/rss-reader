// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

/**
 * Deserializes an xml document representing a feed into a feed object
 * TODO: some concerns regarding how querySelector probes all descendants.
 * Could this find the wrong fields? Should we be restricting to immediate?
 *
 * TODO: hash was deprecated, all entries must have links now to survive,
 * which means the filtering of linkless entries has to happen somewhere, 
 * so maybe it happens here?
 *
 * TODO: support Apple iTunes format
 * TODO: support embedded media format (??)
 */
lucu.feed.deserialize = function(document) {
  'use strict';
  
  const rootElement = document.documentElement;
  if(!rootElement) {
    throw new TypeError('Undefined document element');
  }
  
  if(rootElement.matches('feed')) {
    return lucu.feed.deserializeAtomFeed(rootElement);
  }
  
  if(rootElement.matches('rss, rdf')) {
    return lucu.feed.deserializeRSSFeed(rootElement);
  }

  throw new TypeError('Unsupported document element ' + rootElement.localName);
};

lucu.feed.selectTrimmedTextContent = function(parent, selector) {
  'use strict';
  
  const element = parent.querySelector(selector);
  if(!element) {
    return;
  }
  
  const text = element.textContent;
  if(!text) {
    return;
  }

  return text.trim();
};

lucu.feed.deserializeAtomFeed = function(root) {
  'use strict';

  const getText = lucu.feed.selectTrimmedTextContent;
  const result = {};

  const title = getText(root, 'title');
  if(title) {
    result.title = title;  
  }

  const description = getText(root, 'subtitle');
  if(description) {
    result.description = description;
  }

  const updated = getText(root, 'updated');
  if(updated) {
    result.date = updated;
  }

  var link = root.querySelector('link[rel="alternate"]');
  link = link || root.querySelector('link[rel="self"]');
  link = link || root.querySelector('link[href]');
  
  if(link) {
    link = link.getAttribute('href');
  }
  
  if(link) {
    result.link = link.trim();
  }

  const entries = root.querySelectorAll('entry');
  result.entries = Array.prototype.map.call(entries, 
    lucu.feed.deserializeAtomEntry);

  return result;
};

lucu.feed.deserializeAtomEntry = function(entry) {
  'use strict';
  const getText = lucu.feed.selectTrimmedTextContent;
  const result = {};

  // TODO: only define properties if truthy

  result.title = getText(entry, 'title');
  result.author = stripTags(getText(entry, 'author name'), ' ');
  var link = entry.querySelector('link[rel="alternate"]');
  link = link || entry.querySelector('link[rel="self"]');
  link = link || entry.querySelector('link[href]');
  if(link) {
    link = link.getAttribute('href');
  }
  if(link) {
    result.link = link.trim();
  }
  var date = entry.querySelector('published');
  date = date || entry.querySelector('updated');
  if(date) {
    date = date.textContent;
  }
  if(date) {
    result.pubdate = date.trim();
  }

  // Special handling for atom entry content. For some reason this works
  // where normal content.textContent does not. I think the issue pertains to
  // whether content is CDATA.
  const content = entry.querySelector('content');
  const nodes = content ? content.childNodes : [];
  result.content = Array.prototype.map.call(nodes, 
    lucu.feed.getAtomNodeTextContent).join('').trim();
  return result;
};

lucu.feed.getAtomNodeTextContent = function(node) {
  return node.nodeType == Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
};

lucu.feed.deserializeRSSFeed = function(root) {
  'use strict';
  const isRDF = root.matches('rdf');
  const getText = lucu.feed.selectTrimmedTextContent;
  const result = {};
  const channel = root.querySelector('channel');
  if(!channel) {
    console.warn('No channel found!? %o', root);
    result.entries = [];
    return result;
  }
  result.title = getText(channel, 'title');
  result.description = getText(channel, 'description');
  var link = getText(channel, 'link:not([href])')
  if(!link) {
    link = channel.querySelector('link');
    if(link) link = link.getAttribute('href');
    if(link) link = link.trim();
  }
  if(link) result.link = link;
  const date = getText(channel, 'pubdate') || 
    getText(channel, 'lastBuildDate') ||
    getText(channel, 'date');
  if(date) {
    result.date = date;
  }
  const entriesParent = isRDF ? root : channel;
  const entries = entriesParent.querySelectorAll('item');
  result.entries = Array.prototype.map.call(entries, 
    lucu.feed.deserializeRSSEntry);
  return result;
};

lucu.feed.deserializeRSSEntry = function(entry) {
  'use strict';
  const getText = lucu.feed.selectTrimmedTextContent;
  const result = {};
  result.title = getText(entry, 'title');
  
  const link = getText(entry, 'origLink') || getText(entry, 'link');
  if(link) {
    result.link = link;
  }
  
  const author = getText(entry, 'creator') || getText(entry, 'publisher');
  if(author) {
    result.author = stripTags(author, ' ');
  }
  
  const date = getText(entry, 'pubDate') || getText(entry, 'date');
  if(date) {
    result.pubdate = date;
  }
  
  const content = getText(entry, 'encoded') || 
    getText(entry, 'description') ||
    getText(entry, 'summary');
  if(content) {
    result.content = content;
  }
  
  return result;
};
