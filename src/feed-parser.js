// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for unmarshalling an xml document into a feed object. The values stored
// in the feed object are not sanitized, and should be sanitized later by the
// caller before rendering/storing
// TODO: now that the parser sets the type property, all the other code needs
// to support it (e.g. save it, update it properly) - this is a general note
// TODO: store URL strings as URL objects
const FeedParser = {};

// Unmarshall an xml document into a feed object
FeedParser.parse = function(document, excludeEntries) {

  if(!document) {
    throw new Error('Undefined document');
  }

  const documentElement = document.documentElement;
  if(!documentElement) {
    throw new Error('Undefined document element');
  }

  // NOTE: selector must be lowercase to match, I do not have a clear
  // understanding of why, i suppose it is related to the document being
  // xml-flagged?

  if(!documentElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' +
      documentElement.nodeName);
  }

  const channel = FeedParser.findChannel(documentElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = FeedParser.getFeedType(documentElement);
  feed.title = FeedParser.findChildElementText(channel, 'TITLE');
  feed.description = FeedParser.findChildElementText(channel,
    documentElement.matches('feed') ? 'SUBTITLE' : 'DESCRIPTION');
  feed.date = FeedParser.findFeedDate(channel);
  feed.link = FeedParser.findFeedLink(channel);

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

  // TODO: this should probably be delegated to some general purpose
  // dom-find-all or dom-filter-children function
  for(let element = entryParent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(utils.string.equalsIgnoreCase(element.nodeName, entryNodeName)) {
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
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    utils.string.equalsIgnoreCase(element.getAttribute('rel'), 'ALTERNATE');
};

FeedParser.isLinkRelSelf = function(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    utils.string.equalsIgnoreCase(element.getAttribute('rel'), 'SELF');
};

FeedParser.isLinkWithHref = function(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    element.hasAttribute('href');
};

// NOTE: this is not necessarily the simple inverse of
// FeedParser.isLinkWithHref, because that could be any element
FeedParser.isLinkWithoutHref = function(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    !element.hasAttribute('href');
};

FeedParser.findFeedLink = function(channelElement) {
  const isAtom = channelElement.ownerDocument.documentElement.matches('feed');
  let linkText, linkElement;
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
    return linkText.trim();
  }
};

FeedParser.createEntryFromElement = function(entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');
  const result = {};
  result.title = FeedParser.findChildElementText(entryElement, 'TITLE');
  result.author = FeedParser.findEntryAuthor(entryElement);
  result.link = FeedParser.findEntryLink(entryElement);
  result.pubdate = FeedParser.findEntryDate(entryElement);
  result.content = FeedParser.findEntryContent(entryElement);

  // NOTE: An enclosure is once per item
  // TODO: i suppose the url resolution processing that happens in other Lib
  // needs to remember to also account for enclosure urls, most enc urls are
  // absolute so it is not an urgent issue
  // TODO: move this into a separate function similar to the helper functions
  // for other entry fields
  const enclosure = FeedParser.findChildElementByName(entryElement,
    'ENCLOSURE');
  if(enclosure) {
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
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
    linkText = linkText.trim();
  }
  return linkText;
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
    return utils.string.equalsIgnoreCase(element.nodeName, nodeName);
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
