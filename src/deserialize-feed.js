// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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
lucu.deserializeFeed = function(document) {
  'use strict';
  
  var rootElement = document.documentElement;
  if(!rootElement) {
    throw new TypeError('Undefined document element');
  }
  
  if(rootElement.matches('feed')) {
    return lucu.deserializeAtomFeed(rootElement);
  }
  
  if(rootElement.matches('rss, rdf')) {
    return lucu.deserializeRSSFeed(rootElement);
  }

  throw new TypeError('lucu.deserializeFeed: Unsupported document element ' + 
    rootElement.localName);
};

lucu.selectTrimmedTextContent = function(parent, selector) {
  'use strict';
  var element = parent.querySelector(selector);
  if(!element) return;
  var text = element.textContent;
  if(!text) return;
  return text.trim();
};

lucu.deserializeAtomFeed = function(root) {
  'use strict';

  var getText = lucu.selectTrimmedTextContent;
  var result = {};

  var title = getText(root, 'title');
  if(title) {
    result.title = title;  
  }

  var description = getText(root, 'subtitle');
  if(description) {
    result.description = description;
  }

  var updated = getText(root, 'updated');
  if(updated) {
    result.date = updated;
  }

  var link = root.querySelector('link[rel="alternate"]');
  link = link || root.querySelector('link[rel="self"]');
  link = link || root.querySelector('link[href]');
  
  if(link) link = link.getAttribute('href');
  if(link) result.link = link.trim();

  var entries = root.querySelectorAll('entry');
  result.entries = Array.prototype.map.call(entries, lucu.deserializeAtomEntry);

  return result;
};

lucu.deserializeAtomEntry = function(entry) {
  'use strict';
  var getText = lucu.selectTrimmedTextContent;
  var result = {};

  // TODO: only define properties if truthy

  result.title = getText(entry, 'title');
  result.author = lucu.string.stripTags(getText(entry, 'author name'), ' ');
  var link = entry.querySelector('link[rel="alternate"]') ||
    entry.querySelector('link[rel="self"]') ||
    entry.querySelector('link[href]');
  if(link) link = link.getAttribute('href');
  if(link) result.link = link.trim();
  var date = entry.querySelector('published') ||
    entry.querySelector('updated');
  if(date) date = date.textContent;
  if(date) result.pubdate = date.trim();

  // Special handling for atom entry content. For some reason this works
  // where normal content.textContent does not. I think the issue pertains to
  // whether content is CDATA.
  var content = entry.querySelector('content');
  var nodes = content ? content.childNodes : [];
  result.content = Array.prototype.map.call(nodes, 
    lucu.getAtomNodeTextContent).join('').trim();
  return result;
};

lucu.getAtomNodeTextContent = function(node) {
  return node.nodeType == Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
};

lucu.deserializeRSSFeed = function(root) {
  'use strict';
  var isRDF = root.matches('rdf');
  var getText = lucu.selectTrimmedTextContent;
  var result = {};
  var channel = root.querySelector('channel');
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
  var date = getText(channel, 'pubdate') || 
    getText(channel, 'lastBuildDate') ||
    getText(channel, 'date');
  if(date) result.date = date;
  var entriesParent = isRDF ? root : channel;
  var entries = entriesParent.querySelectorAll('item');
  var map = Array.prototype.map;
  result.entries = map.call(entries, lucu.deserializeRSSEntry);
  return result;
};

lucu.deserializeRSSEntry = function(entry) {
  'use strict';
  var getText = lucu.selectTrimmedTextContent;
  var result = {};
  result.title = getText(entry, 'title');
  var link = getText(entry, 'origLink') || getText(entry, 'link');
  if(link) result.link = link;
  var author = getText(entry, 'creator') || getText(entry, 'publisher');
  if(author) result.author = lucu.string.stripTags(author, ' ');
  var date = getText(entry, 'pubDate') || getText(entry, 'date');
  if(date) result.pubdate = date;
  var content = getText(entry, 'encoded') || getText(entry, 'description') ||
    getText(entry, 'summary');
  if(content) result.content = content;
  return result;
};
