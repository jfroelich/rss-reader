// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedParser = {};

FeedParser.parseDocument = function(document, excludeEntries) {
  console.assert(document, 'document is required');

  const docElement = document.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = FeedParser.findChannel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = new Feed();

  feed.type = FeedParser.getFeedType(docElement);
  feed.title = FeedParser.findChildElementText(channel, 'title');
  feed.description = FeedParser.findChildElementText(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = FeedParser.findFeedLink(channel);
  feed.datePublished = FeedParser.findFeedDatePublished(channel);

  if(!excludeEntries) {
    const entryElements = FeedParser.findEntries(channel);
    const entryObjects = entryElements.map(
      FeedParser.createEntryFromElement.bind(null, feed.datePublished));
    for(let entryObject of entryObjects) {
      feed.addEntry(entryObject);
    }
  }

  return feed;
};

FeedParser.findChannel = function(documentElement) {
  if(documentElement.matches('feed')) {
    return documentElement;
  } else {
    return FeedParser.findChildElementByName(documentElement, 'channel');
  }
};

FeedParser.findEntries = function(channel) {
  const documentElement = channel.ownerDocument.documentElement;
  const entries = [];
  let entryParent;
  let entryLocalName;

  if(documentElement.matches('feed')) {
    entryParent = documentElement;
    entryLocalName = 'entry';
  } else if(documentElement.matches('rdf')) {
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

FeedParser.getFeedType = function(documentElement) {
  let type = null;
  if(documentElement.matches('feed')) {
    type = 'feed';
  } else if(documentElement.matches('rdf')) {
    type = 'rdf';
  } else {
    type = 'rss';
  }
  return type;
};

FeedParser.findFeedDatePublished = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = FeedParser.findChildElementText(channel, 'updated');
  } else {
    dateText = FeedParser.findChildElementText(channel, 'pubdate') ||
      FeedParser.findChildElementText(channel, 'lastbuilddate') ||
      FeedParser.findChildElementText(channel, 'date');
  }

  if(dateText) {
    try {
      return new Date(dateText);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // TODO: actually i should try and represent the feed as is here, this
  // shouldn't be introducing processing logic, that is a caller responsibility
  // this also means that passing date published to createEntryFromElement
  // needs to have that function account for undefined if i remove this
  // Fall back to the current date
  return new Date();
};

FeedParser.isLinkRelAlternate = function(element) {
  return element.matches('link[rel="alternate"]');
};

FeedParser.isLinkRelSelf = function(element) {
  return element.matches('link[rel="self"]');
};

FeedParser.isLinkWithHref = function(element) {
  return element.matches('link[href]');
};

FeedParser.isLinkWithoutHref = function(element) {
  // return element.matches('link:not([href])');
  return element.localName === 'link' && !element.hasAttribute('href');
};

FeedParser.findFeedLink = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = FeedParser.findChildElement(channel,
      FeedParser.isLinkRelAlternate) ||
      FeedParser.findChildElement(channel, FeedParser.isLinkRelSelf) ||
      FeedParser.findChildElement(channel, FeedParser.isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = FeedParser.findChildElement(channel,
      FeedParser.isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = FeedParser.findChildElement(channel,
        FeedParser.isLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
};

FeedParser.createEntryFromElement = function(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');

  const entryObject = new Entry();

  const title = FeedParser.findChildElementText(entryElement, 'title');
  if(title) {
    entryObject.title = title;
  }

  const author = FeedParser.findEntryAuthor(entryElement);
  if(author) {
    entryObject.author = author;
  }

  // Set the link url as the entry's initial url
  const entryLinkURL = FeedParser.findEntryLink(entryElement);
  if(entryLinkURL) {
    entryObject.addURL(entryLinkURL);
  }

  const entryDatePublished = FeedParser.findEntryDatePublished(entryElement);
  if(entryDatePublished) {
    entryObject.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entryObject.datePublished = feedDatePublished;
  } else {
    // TODO: actually i probably shouldn't infer this date and should leave it
    // as not set
    // Fall back to the current date
    entryObject.datePublished = new Date();
  }

  const content = FeedParser.findEntryContent(entryElement);
  if(content) {
    entryObject.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = FeedParser.findChildElementByName(entryElement,
    'enclosure');
  if(enclosure) {
    const enclosureURLString = enclosure.getAttribute('url');
    let enclosureURL = null;
    if(enclosureURLString) {
      try {
        enclosureURL = new URL(enclosureURLString);
      } catch(exception) {
        console.debug(exception);
      }
    }

    entryObject.enclosure = {
      'url': enclosureURL,
      'length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entryObject;
};

FeedParser.findEntryAuthor = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = FeedParser.findChildElementByName(entry, 'author');
    if(author) {
      return FeedParser.findChildElementText(author, 'name');
    }
  } else {
    return FeedParser.findChildElementText(entry, 'creator') ||
      FeedParser.findChildElementText(entry, 'publisher');
  }
};

FeedParser.findEntryLink = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = FeedParser.findChildElement(entry,
        FeedParser.isLinkRelAlternate) ||
      FeedParser.findChildElement(entry, FeedParser.isLinkRelSelf) ||
      FeedParser.findChildElement(entry, FeedParser.isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = FeedParser.findChildElementText(entry, 'origlink') ||
      FeedParser.findChildElementText(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
};

FeedParser.findEntryDatePublished = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let datePublishedString = null;

  if(isAtom) {
    datePublishedString = FeedParser.findChildElementText(entry,
      'published') || FeedParser.findChildElementText(entry, 'updated');
  } else {
    datePublishedString = FeedParser.findChildElementText(entry, 'pubdate') ||
      FeedParser.findChildElementText(entry, 'date');
  }

  if(datePublishedString) {
    datePublishedString = datePublishedString.trim();
  }

  if(datePublishedString) {
    try {
      return new Date(datePublishedString);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // If we did not find a valid date, then return null. Do not return today's
  // date or infer anything. This only parses the document as is.
  return null;
};

FeedParser.findEntryContent = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = FeedParser.findChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, FeedParser.getAtomNodeText).join('').trim();
  } else {

    result = FeedParser.findChildElementText(entry, 'encoded') ||
      FeedParser.findChildElementText(entry, 'description') ||
      FeedParser.findChildElementText(entry, 'summary');
  }
  return result;
};

FeedParser.getAtomNodeText = function(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
};

FeedParser.findChildElement = function(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
};

FeedParser.findChildElementByName = function(parentElement, localName) {

  function hasLocalName(element) {
    return element.localName === localName;
  }

  return FeedParser.findChildElement(parentElement, hasLocalName);
};

FeedParser.findChildElementText = function(element, localName) {
  const childElement = FeedParser.findChildElementByName(element, localName);
  if(childElement) {
    const childText = childElement.textContent;
    if(childText) {
      return childText.trim();
    }
  }
};
