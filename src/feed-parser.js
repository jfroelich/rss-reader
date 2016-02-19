// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

const FeedParser = {};

FeedParser.elementHasName = function(name, element) {
  return name === element.localName;
};

FeedParser.isChannelElement = FeedParser.elementHasName.bind(null, 'channel');
FeedParser.isTitleElement = FeedParser.elementHasName.bind(null, 'title');

FeedParser.getChannelElement = function(document) {
  'use strict';
  const documentElement = document.documentElement;
  if(documentElement.matches('feed'))
    return documentElement;
  const childNodes = documentElement.childNodes;
  const find = Array.prototype.find;
  return find.call(childNodes, FeedParser.isChannelElement);
};

FeedParser.setIfDefined = function(object, property, value) {
  'use strict';
  if(value) {
    object[property] = value;
  }
};

FeedParser.parseDocument = function(document) {
  'use strict';

  const documentElement = document.documentElement;
  if(!documentElement) {
    throw new Error('Undefined document element');
  }

  if(!documentElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' +
      element.localName);
  }

  const isAtom = documentElement.matches('feed');
  const isRDF = documentElement.matches('rdf');
  const channel = FeedParser.getChannelElement(document);
  if(!channel) {
    throw new Error('Missing required channel element or no '+
      'document element found');
  }

  const feed = {};

  if(isAtom) {
    feed.type = 'feed';
  } else if(isRDF) {
    feed.type = 'rdf';
  } else {
    feed.type = 'rss';
  }

  const getText = FeedParser.getElementText;
  const channelFindText = FeedParser.findText.bind(null, channel);
  const setIfDefined = FeedParser.setIfDefined;

  // delete after testing
  //const title = getText(channel, 'title');
  //if(title) {
  //  feed.title = title;
  //}

  setIfDefined(feed, 'title', channelFindText(FeedParser.isTitleElement));

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
    entries = documentElement.querySelectorAll('entry');
  } else if(isRDF) {
    entries = documentElement.querySelectorAll('item');
  } else {
    entries = channel.querySelectorAll('item');
  }

  const map = Array.prototype.map;

  feed.entries = map.call(entries, FeedParser.parseEntry.bind(null, isAtom));

  return feed;
};

FeedParser.parseEntry = function(isAtom, entry) {
  'use strict';
  const getText = FeedParser.getElementText;
  const result = {};
  const title = getText(entry, 'title');
  if(title) {
    result.title = title;
  }

  const author = isAtom ? getText(entry, 'author name') :
    (getText(entry, 'creator') || getText(entry, 'publisher'));
  if(author) {
    result.author = utils.replaceHTML(author, ' ');
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
    // Special handling for some strange issue (CDATA-related?)
    const content = entry.querySelector('content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    // TODO: separate out this nested function
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

  // an enclosure is once per item
  const enclosure = entry.querySelector('enclosure');
  if(enclosure) {
    // console.debug('Encountered enclosure: %o', enclosure);
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
};

FeedParser.findText = function(parentElement, predicate) {
  'use strict';
  const find = Array.prototype.find;
  const childNodes = parentElement.childNodes;
  const element = find.call(childNodes, predicate);
  if(element) {
    const text = element.textContent;
    if(text) {
      return text.trim();
    }
  }
};

// Returns the text content of the first element matching the
// selector within the parent, or undefined
FeedParser.getElementText = function(parent, selector) {
  'use strict';
  const element = parent.querySelector(selector);
  if(element) {
    const text = element.textContent;
    if(text) {
      return text.trim();
    }
  }
};
