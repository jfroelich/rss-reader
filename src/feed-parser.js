// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

const FeedParser = {};

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
    throw new Error('Missing channel element');
  }

  const feed = {};
  FeedParser.setFeedType(isAtom, isRDF, feed);
  FeedParser.setFeedTitle(channel, feed);
  FeedParser.setFeedDescription(isAtom, channel, feed);
  FeedParser.setFeedDate(isAtom, channel, feed);
  FeedParser.setFeedLink(isAtom, channel, feed);

  const entries = FeedParser.getEntryElements(isAtom, isRDF, documentElement,
    channel);
  feed.entries = entries.map(FeedParser.parseEntry.bind(null, isAtom));
  return feed;
};

FeedParser.getEntryElements = function(isAtom, isRDF, documentElement,
  channel) {
  'use strict';
  const entries = [];
  let entryParent;
  let entryLocalName;
  if(isAtom) {
    entryParent = documentElement;
    entryLocalName = 'entry';
  } else if(isRDF) {
    entryParent = documentElement;
    entryLocalName = 'item';
  } else {
    entryParent = channel;
    entryLocalName = 'item';
  }

  for(let element = entryParent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName === entryLocalName) {
      entries.push(element);
    }
  }

  return entries;
};

FeedParser.setFeedType = function(isAtom, isRDF, feed) {
  'use strict';
  if(isAtom) {
    feed.type = 'feed';
  } else if(isRDF) {
    feed.type = 'rdf';
  } else {
    feed.type = 'rss';
  }
};

FeedParser.setFeedTitle = function(channel, feed) {
  'use strict';
  const title = FeedParser.findText(channel, 'title');
  if(title) {
    feed.title = title;
  }
};

FeedParser.setFeedDescription = function(isAtom, channel, feed) {
  'use strict';
  const description = FeedParser.findText(channel, isAtom ?
    'subtitle' : 'description');
  if(description) {
    feed.description = description;
  }
};

FeedParser.setFeedDate = function(isAtom, channel, feed) {
  'use strict';
  let date = null;
  if(isAtom) {
    date = FeedParser.findText(channel, 'updated');
  } else {
    date = FeedParser.findText(channel, 'pubdate');
    if(!date) date = FeedParser.findText(channel, 'lastbuilddate');
    if(!date) date = FeedParser.findText(channel, 'date');
  }
  if(date) {
    feed.date = date;
  }
};

FeedParser.setFeedLink = function(isAtom, channel, feed) {
  'use strict';

  const findChildElement = FeedParser.findChildElement;

  const isLinkRelAlternate = function(element) {
    return element.localName === 'link' &&
      element.getAttribute('rel') === 'alternate';
  };

  const isLinkRelSelf = function(element) {
    return element.localName === 'link' &&
      element.getAttribute('rel') === 'self';
  };

  const isLinkWithHref = function(element) {
    return element.localName === 'link' &&
      element.hasAttribute('href');
  };

  const isLinkWithoutHref = function(element) {
    return element.localName === 'link' && !element.hasAttribute('href');
  };

  let linkText, linkElement;
  if(isAtom) {
    linkElement = findChildElement(channel, isLinkRelAlternate) ||
      findChildElement(channel, isLinkRelSelf) ||
      findChildElement(channel, isLinkWithHref);
    if(linkElement)
      linkText = linkElement.getAttribute('href');
  } else {
    linkElement = findChildElement(channel, isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = findChildElement(channel, isLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  if(linkText) {
    linkText = linkText.trim();
    if(linkText) {
      feed.link = linkText;
    }
  }
};

FeedParser.getChannelElement = function(document) {
  'use strict';
  const element = document.documentElement;
  return element.matches('feed') ? element :
    FeedParser.findChildElementByName(element, 'channel');
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
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
};

FeedParser.findChildElement = function(parent, predicate) {
  'use strict';
  for(let element = parent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
};

FeedParser.findChildElementByName = function(parent, localName) {
  'use strict';
  return FeedParser.findChildElement(parent, function(element) {
    return element.localName === localName;
  });
};

FeedParser.findText = function(element, name) {
  'use strict';
  const childElement = FeedParser.findChildElementByName(element, name);
  if(childElement) {
    const text = childElement.textContent;
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
