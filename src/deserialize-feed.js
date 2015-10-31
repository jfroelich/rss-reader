// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: support Apple iTunes format, embedded media format (??)
// TODO: store original format
function deserializeFeed(document) {
  'use strict';

  function getText(parent, selector) {
    const element = parent.querySelector(selector);
    if(element) {
      const text = element.textContent;
      if(text) {
        return text.trim();
      }
    }
  }

  const root = document.documentElement;
  if(!root) {
    throw new TypeError('Undefined document element');
  }

  if(!root.matches('feed, rss, rdf')) {
    throw new TypeError('Unsupported document element: ' + root.localName);
  }

  const isAtom = root.matches('feed');
  const isRDF = root.matches('rdf');

  if(!isAtom && !root.querySelector('channel')) {
    return {
      entries: []
    };
  }

  const channel = isAtom ? root : root.querySelector('channel');

  const feed = {};
  const title = getText(channel, 'title');
  if(title) {
    feed.title = title;
  }

  const description = getText(channel, isAtom ? 'subtitle' : 'description');
  if(description) {
    feed.description = description;
  }

  const dateUpdated = isAtom ? getText(channel, 'updated') : 
    (getText(channel, 'pubdate') || getText(channel, 'lastBuildDate') ||
    getText(channel, 'date'));
  if(dateUpdated) {
    feed.date = dateUpdated;
  }

  let link = '';
  if(isAtom) {
    link = channel.querySelector('link[rel="alternate"]') || 
      channel.querySelector('link[rel="self"]') ||
      channel.querySelector('link[href]');
    if(link) {
      link = link.getAttribute('href');
    }
  } else {
    link = getText(channel, 'link:not([href])');
    if(!link) {
      link = channel.querySelector('link');
      if(link) {
        link = link.getAttribute('href');
      }
    }
  }
  if(link) {
    link = link.trim();
  }
  if(link) {
    feed.link = link;
  }

  let entries = [];
  if(isAtom) {
    entries = root.querySelectorAll('entry');
  } else if(isRDF) {
    entries = root.querySelectorAll('item');
  } else {
    entries = channel.querySelectorAll('item');
  }

  const map = Array.prototype.map;

  feed.entries = map.call(entries, function(entry) {
    const result = {};
    const title = getText(entry, 'title');
    if(title) {
      result.title = title;
    }

    const author = isAtom ? getText(entry, 'author name') : 
      (getText(entry, 'creator') || getText(entry, 'publisher'));
    if(author) {
      result.author = stripTags(author, ' ');
    }

    let link = '';
    if(isAtom) {
      link = entry.querySelector('link[rel="alternate"]') || 
        entry.querySelector('link[rel="self"]') ||
        entry.querySelector('link[href]');
      if(link) {
        link = link.getAttribute('href');
      }
    } else {
      link = getText(entry, 'origLink') || getText(entry, 'link');
    }
    if(link) {
      link = link.trim();
    }
    if(link) {
      result.link = link;
    }

    let date = '';
    if(isAtom) {
      date = entry.querySelector('published') || entry.querySelector('updated');
      if(date) {
        date = date.textContent;
      }
    } else {
      date = getText(entry, 'pubDate') || getText(entry, 'date');
    }
    if(date) {
      date = date.trim();
    }
    if(date) {
      result.pubdate = date;
    }

    if(isAtom) {
      // Special handling for some strange issue
      const content = entry.querySelector('content');
      const nodes = content ? content.childNodes : [];
      result.content = map.call(nodes, function(node) {
        return node.nodeType === Node.ELEMENT_NODE ?
          node.innerHTML : node.textContent;
      }).join('').trim();
    } else {
      const content = getText(entry, 'encoded') || 
        getText(entry, 'description') || getText(entry, 'summary');
      if(content) {
        result.content = content;
      }
    }

    return result;
  });

  return feed;
}
