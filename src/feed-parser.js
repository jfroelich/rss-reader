// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';



// Lib for unmarshalling an xml document into a feed object. The values stored
// in the feed object are not sanitized, and should be sanitized later by the
// caller before rendering/storing
// TODO: now that the parser sets the type property, all the other code needs
// to support it (e.g. save it, update it properly) - this is a general note
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

  // TODO: rename this to something clearer
  feed.date = FeedParser.findFeedDate(channel);

  // NOTE: this is now a URL object or undefined/null
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

  // NOTE: new URL tolerates extraneous whitespace so there is no need to trim
  //if(linkText) {
  //  return linkText.trim();
  //}

  // Return a URL object
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
  entryObject.title = FeedParser.findChildElementText(entryElement, 'TITLE');
  entryObject.author = FeedParser.findEntryAuthor(entryElement);



  // TODO: I think I should be rewriting entry.link urls, and if rewritten,
  // storing both the original and the rewritten in the urls array.
  // TODO: I don't even think I should be storing a link property anymore,
  // I should only use the urls property, and consider the last url in the
  // list to be the best url to use.

  const entryLinkURLObject = FeedParser.findEntryLink(entryElement);
  entryObject.link = entryLinkURLObject;

  // Define the 'urls' property, which is an array of the entry's various
  // urls as strings.
  entryObject.urls = [];

  if(entryLinkURLObject) {
    entryObject.urls.push(entryLinkURLObject.href);
  }

  entryObject.pubdate = FeedParser.findEntryDate(entryElement);
  entryObject.content = FeedParser.findEntryContent(entryElement);

  // NOTE: An enclosure is once per item
  // TODO: i suppose the url resolution processing that happens in other Lib
  // needs to remember to also account for enclosure urls, most enc urls are
  // absolute so it is not an urgent issue
  // TODO: move this into a separate function similar to the helper functions
  // for other entry fields
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

    // NOTE: url is now a URL object
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

  // NOTE: This now returns a URL object
  //if(linkText) {
  //  linkText = linkText.trim();
  //}
  //return linkText;
  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // default return undefined
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
