// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: some concerns regarding how querySelector probes all descendants.
// Could this find the wrong fields? Should we be restricting to immediate?
// TODO: hash was deprecated, all entries must have links now to survive,
// which means the filtering of linkless entries has to happen somewhere, 
// so maybe it happens here?
// TODO: support Apple iTunes format, embedded media format (??)
function deserializeFeed(document) {
  'use strict';
  
  const root = document.documentElement;
  if(!root) {
    throw new TypeError('Undefined document element');
  }
  
  if(root.matches('feed')) {
    return deserializeAtomFeed();
  } else if(root.matches('rss, rdf')) {
    return deserializeRSSFeed();
  } else {
    throw new TypeError('Unsupported document element ' + root.localName);
  }

  function getText(parent, selector) {
    const element = parent.querySelector(selector);
    if(element) {
      const text = element.textContent;
      if(text) {
        return text.trim();
      }
    }
  }

  function deserializeAtomFeed() {
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
      deserializeAtomEntry);
    return result;
  }

  function deserializeAtomEntry(entry) {
    const result = {};
    let title = getText(entry, 'title');
    if(title) {
      result.title = title;
    }
    let author = stripTags(getText(entry, 'author name'), ' ');
    if(author) {
      result.author = author;
    }
    let link = entry.querySelector('link[rel="alternate"]');
    link = link || entry.querySelector('link[rel="self"]');
    link = link || entry.querySelector('link[href]');
    if(link) {
      link = link.getAttribute('href');
    }
    if(link) {
      result.link = link.trim();
    }
    let date = entry.querySelector('published');
    date = date || entry.querySelector('updated');
    if(date) {
      date = date.textContent;
    }
    if(date) {
      result.pubdate = date.trim();
    }

    // Special handling for some strange issue
    const content = entry.querySelector('content');
    const nodes = content ? content.childNodes : [];
    result.content = Array.prototype.map.call(nodes, 
      getAtomNodeTextContent).join('').trim();
    return result;
  }

  function getAtomNodeTextContent(node) {
    return node.nodeType == Node.ELEMENT_NODE ?
      node.innerHTML : node.textContent;
  }

  function deserializeRSSFeed() {
    const isRDF = root.matches('rdf');
    const result = {};
    const channel = root.querySelector('channel');
    if(!channel) {
      result.entries = [];
      return result;
    }
    result.title = getText(channel, 'title');
    result.description = getText(channel, 'description');
    let link = getText(channel, 'link:not([href])')
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
      deserializeRSSEntry);
    return result;
  }

  function deserializeRSSEntry(entry) {
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
  }
}
