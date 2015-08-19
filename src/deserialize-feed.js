// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Deserializes an xml document representing a feed into a feed object
 * TODO: some concerns regarding how querySelector probes all descendants.
 * Could this find the wrong fields? Should we be restricting to immediate?
 */
lucu.deserializeFeed = function(document) {
  'use strict';
  var e = document.documentElement;
  if(!e) throw new TypeError('Undefined document element');
  if(e.matches('feed')) return lucu.deserializeAtomFeed(e);
  if(e.matches('rss, rdf')) return lucu.deserializeRSSFeed(e);
  throw new TypeError('Unsupported document element ' + e.localName);
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
  var map = Array.prototype.map;
  var getText = lucu.selectTrimmedTextContent;
  var result = {};
  var feed = root;
  result.title = getText(feed, 'title');
  result.description = getText(feed, 'subtitle');
  result.date = getText(feed, 'updated');
  var link = feed.querySelector('link[rel="alternate"]') ||
    feed.querySelector('link[rel="self"]') || feed.querySelector('link[href]');
  if(link) link = link.getAttribute('href');
  if(link) result.link = link.trim();
  var entries = feed.querySelectorAll('entry');
  result.entries = map.call(entries, lucu.deserializeAtomEntry);
  return result;
};

lucu.deserializeAtomEntry = function(entry) {
  'use strict';
  var getText = lucu.selectTrimmedTextContent;
  var result = {};
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
  // whether content contains CDATA.
  var content = entry.querySelector('content');
  var nodes = content ? content.childNodes : [];
  var map = Array.prototype.map;
  result.content = map.call(nodes, 
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
    // our contract warrants entries is defined
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
