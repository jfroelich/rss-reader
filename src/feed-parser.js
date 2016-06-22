// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedParser = Object.create(null);

FeedParser.parse = function(document, excludeEntries) {

  if(!document) {
    throw new Error('Undefined document');
  }

  const documentElement = document.documentElement;
  if(!documentElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' +
      documentElement.nodeName);
  }

  const channel = FeedParser.findChannel(documentElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = Object.create(null);

  feed.type = FeedParser.getFeedType(documentElement);
  feed.title = FeedParser.findChildElementText(channel, 'TITLE');
  feed.description = FeedParser.findChildElementText(channel,
    documentElement.matches('feed') ? 'SUBTITLE' : 'DESCRIPTION');
  feed.link = FeedParser.findFeedLink(channel);

  // TODO: rename this to something clearer
  feed.date = FeedParser.findFeedDate(channel);

  if(!excludeEntries) {
    const entryElements = FeedParser.findEntries(channel);
    feed.entries = entryElements.map(FeedParser.createEntryFromElement);
  }

  return feed;
};

FeedParser.findChannel = function(documentElement) {
  if(documentElement.matches('feed')) {
    return documentElement;
  } else {
    return FeedParser.findChildElementByName(documentElement, 'CHANNEL');
  }
};

FeedParser.findEntries = function(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const entries = [];
  let entryParent;
  let entryNodeName;

  if(documentElement.matches('feed')) {
    entryParent = documentElement;
    entryNodeName = 'ENTRY';
  } else if(documentElement.matches('rdf')) {
    entryParent = documentElement;
    entryNodeName = 'ITEM';
  } else {
    entryParent = channelElement;
    entryNodeName = 'ITEM';
  }

  for(let element = entryParent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(equalsIgnoreCase(element.nodeName, entryNodeName)) {
      entries.push(element);
    }
  }

  return entries;
};

// Returns a lowercase type of the feed's type
// TODO: maybe this shouldn't assume validity and should also check
// for whether matches rss, and otherwise return null/undefined.
FeedParser.getFeedType = function(documentElement) {
  let typeString = null;
  if(documentElement.matches('feed')) {
    typeString = 'feed';
  } else if(documentElement.matches('rdf')) {
    typeString = 'rdf';
  } else {
    typeString = 'rss';
  }

  return typeString;
};

FeedParser.findFeedDate = function(channelElement) {
  const isAtom = channelElement.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    return FeedParser.findChildElementText(channelElement, 'UPDATED');
  } else {
    return FeedParser.findChildElementText(channelElement, 'PUBDATE') ||
      FeedParser.findChildElementText(channelElement, 'LASTBUILDDATE') ||
      FeedParser.findChildElementText(channelElement, 'DATE');
  }
};

// TODO: maybe just use element.matches('link[rel="alternate"]')
FeedParser.isLinkRelAlternate = function(element) {
  return equalsIgnoreCase(element.nodeName, 'LINK') &&
    equalsIgnoreCase(element.getAttribute('rel'), 'ALTERNATE');
};

FeedParser.isLinkRelSelf = function(element) {
  return equalsIgnoreCase(element.nodeName, 'LINK') &&
    equalsIgnoreCase(element.getAttribute('rel'), 'SELF');
};

FeedParser.isLinkWithHref = function(element) {
  return equalsIgnoreCase(element.nodeName, 'LINK') &&
    element.hasAttribute('href');
};

FeedParser.isLinkWithoutHref = function(element) {
  return equalsIgnoreCase(element.nodeName, 'LINK') &&
    !element.hasAttribute('href');
};

FeedParser.findFeedLink = function(channelElement) {
  const isAtom = channelElement.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = FeedParser.findChildElement(channelElement,
      FeedParser.isLinkRelAlternate) ||
      FeedParser.findChildElement(channelElement,
        FeedParser.isLinkRelSelf) ||
      FeedParser.findChildElement(channelElement,
        FeedParser.isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = FeedParser.findChildElement(channelElement,
      FeedParser.isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = FeedParser.findChildElement(channelElement,
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

FeedParser.createEntryFromElement = function(entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');
  const entryObject = Object.create(null);

  const title = FeedParser.findChildElementText(entryElement, 'TITLE');
  if(title) {
    entryObject.title = title;
  }

  const author = FeedParser.findEntryAuthor(entryElement);
  if(author) {
    entryObject.author = author;
  }

  entryObject.urls = [];
  const entryLinkURL = FeedParser.findEntryLink(entryElement);
  if(entryLinkURL) {
    entryObject.urls.push(entryLinkURL);
  }

  // TODO: use a better name
  // TODO: parse into a Date
  const pubdate = FeedParser.findEntryDate(entryElement);
  if(pubdate) {
    entryObject.pubdate = pubdate;
  }

  const content = FeedParser.findEntryContent(entryElement);
  if(content) {
    entryObject.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = FeedParser.findChildElementByName(entryElement,
    'ENCLOSURE');
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
    const author = FeedParser.findChildElementByName(entry, 'AUTHOR');
    if(author) {
      return FeedParser.findChildElementText(author, 'NAME');
    }
  } else {
    return FeedParser.findChildElementText(entry, 'CREATOR') ||
      FeedParser.findChildElementText(entry, 'PUBLISHER');
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
    linkText = FeedParser.findChildElementText(entry, 'ORIGLINK') ||
      FeedParser.findChildElementText(entry, 'LINK');
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
};

FeedParser.findEntryDate = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let value = null;

  if(isAtom) {
    value = FeedParser.findChildElementText(entry, 'PUBLISHED') ||
      FeedParser.findChildElementText(entry, 'UPDATED');
  } else {
    value = FeedParser.findChildElementText(entry, 'PUBDATE') ||
      FeedParser.findChildElementText(entry, 'DATE');
  }

  if(value) {
    value = value.trim();
  }

  return value;
};

FeedParser.findEntryContent = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = FeedParser.findChildElementByName(entry, 'CONTENT');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, FeedParser.getAtomNodeText).join('').trim();
  } else {
    // TODO: now that I am using nodeName, look into whether
    // content:encoded still works, my instinct is no
    result = FeedParser.findChildElementText(entry, 'ENCODED') ||
      FeedParser.findChildElementText(entry, 'DESCRIPTION') ||
      FeedParser.findChildElementText(entry, 'SUMMARY');
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

FeedParser.findChildElementByName = function(parentElement, nodeName) {
  // NOTE: nodeName is possibly or always lowercase, this has something to
  // do with the document containing the node being xml
  // I know that we are needlessly uppercasing the name each time here, but
  // I like using the same function call used everywhere where names are tested
  function isNodeNameEqual(element) {
    return equalsIgnoreCase(element.nodeName, nodeName);
  }

  return FeedParser.findChildElement(parentElement, isNodeNameEqual);
};

FeedParser.findChildElementText = function(element, nodeName) {
  const childElement = FeedParser.findChildElementByName(element, nodeName);
  if(childElement) {
    const childText = childElement.textContent;
    if(childText) {
      return childText.trim();
    }
  }
};
