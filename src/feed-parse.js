'use strict';

// import base/assert.js
// import base/errors.js
// import xml-parser.js

// TODO: should be using "item" terminology instead of "entry" here

// Parses the input string into a feed object
// @param xml {String} the text to parse
// @throws {AssertionError}
// @throws {ParserError}
// @returns {Object} an object representing the parsed feed and its entries
function feedParseFromString(xml) {

  // Allow errors to bubble
  const doc = XMLParser.parse(xml);

  // Allow errors to bubble
  return feedParseUnmarshallXML(doc);
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a simple object with properties feed and entries
function feedParseUnmarshallXML(document) {
  assert(document instanceof Document);
  const documentElement = document.documentElement;

  const emptyResult = {
    'feed': null,
    'entries': []
  };

  const rootNames = ['feed', 'rdf', 'rss'];
  const documentElementName = documentElement.localName.toLowerCase();
  if(!rootNames.includes(documentElementName)) {
    return emptyResult;
  }

  const channelElement = feedParseFindChannelElement(documentElement);
  if(!channelElement) {
    return emptyResult;
  }

  const feed = {};
  feed.type = feedParseFindFeedType(documentElement);
  feed.title = feedParseFindFeedTitle(channelElement);
  feed.description = feedParseFindFeedDescription(document, channelElement);
  feed.link = feedParseFindFeedLink(channelElement);
  feed.datePublished = feedParseFindFeedDate(channelElement);

  const entryObjects = [];
  const entryElements = feedParseFindEntryElements(channelElement);
  for(const entryElement of entryElements) {
    entryObjects.push(feedParseCreateEntryObject(entryElement));
  }

  const result = {};
  result.feed = feed;
  result.entries = entryObjects;
  return result;
}

function feedParseFindFeedTitle(channelElement) {
  return feedParseFindChildElementText(channelElement, 'title');
}

function feedParseFindFeedDescription(document, channelElement) {
  const documentElement = document.documentElement;
  const documentElementName = documentElement.localName.toLowerCase();
  const elementName = documentElementName === 'feed' ? 'subtitle' :
    'description';
  return feedParseFindChildElementText(channelElement, elementName);
}

function feedParseFindChannelElement(documentElement) {
  if(documentElement.localName.toLowerCase() === 'feed') {
    return documentElement;
  } else {
    return feedParseFindChildElementByName(documentElement, 'channel');
  }
}

function feedParseFindEntryElements(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const documentElementName = documentElement.localName.toLowerCase();
  const entries = [];
  let parentNode, entryElementName;

  if(documentElementName === 'feed') {
    parentNode = documentElement;
    entryElementName = 'entry';
  } else if(documentElementName === 'rdf') {
    parentNode = documentElement;
    entryElementName = 'item';
  } else if(documentElementName === 'rss') {
    parentNode = channelElement;
    entryElementName = 'item';
  } else {
    throw new Error(`Invalid document element ${documentElement.nodeName}`);
  }

  for(let childElement = parentNode.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    if(childElement.localName.toLowerCase() === entryElementName) {
      entries.push(childElement);
    }
  }

  return entries;
}

function feedParseFindFeedType(documentElement) {
  return documentElement.localName.toLowerCase();
}

function feedParseFindFeedDate(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const feedType = feedParseFindFeedType(documentElement);

  let dateText;
  if(feedType === 'feed') {
    dateText = feedParseFindChildElementText(channelElement, 'updated');
  } else {
    dateText = feedParseFindChildElementText(channelElement, 'pubdate');
    dateText = dateText ||
      feedParseFindChildElementText(channelElement, 'lastbuilddate');
    dateText = dateText ||
      feedParseFindChildElementText(channelElement, 'date');
  }

  if(!dateText) {
    return;
  }

  // TODO: call date_parse in date.js instead?
  let feedDate;
  try {
    feedDate = new Date(dateText);
  } catch(error) {
  }

  return feedDate;
}

function feedParseFindFeedLink(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;

  let linkText, linkElement;
  if(documentElement.localName.toLowerCase() === 'feed') {
    linkElement = feedParseFindChildElement(channelElement,
      feedParseIsLinkRelAltElement);
    linkElement = linkElement ||
      feedParseFindChildElement(channelElement,
        feedParseIsLinkRelSelfElement);
    linkElement = linkElement ||
      feedParseFindChildElement(channelElement,
        feedParseIsLinkWithHrefElement);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = feedParseFindChildElement(channelElement,
      feedParseIsLinkWithoutHrefElement);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = feedParseFindChildElement(channelElement,
        feedParseIsLinkWithHrefElement);
      if(linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    }
  }

  return linkText;
}

function feedParseIsLinkRelAltElement(element) {
  return element.matches('link[rel="alternate"]');
}

function feedParseIsLinkRelSelfElement(element) {
  return element.matches('link[rel="self"]');
}

function feedParseIsLinkWithHrefElement(element) {
  return element.matches('link[href]');
}

function feedParseIsLinkWithoutHrefElement(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function feedParseCreateEntryObject(entryElement) {
  return {
    title: feedParseFindEntryTitle(entryElement),
    author: feedParseFindEntryAuthor(entryElement),
    link: feedParseFindEntryLink(entryElement),
    datePublished: feedParseFindEntryDate(entryElement),
    content: feedParseFindEntryContent(entryElement),
    enclosure: feedParseFindEntryEnclosure(entryElement)
  };
}

function feedParseFindEntryTitle(entryElement) {
  return feedParseFindChildElementText(entryElement, 'title');
}

function feedParseFindEntryEnclosure(entryElement) {
  const enclosureElement = feedParseFindChildElementByName(entryElement,
    'enclosure');

  if(enclosureElement) {
    const enclosureObject = {};
    enclosureObject.url = enclosureElement.getAttribute('url');
    enclosureObject.enclosureLength = enclosureElement.getAttribute('length');
    enclosureObject.type = enclosureElement.getAttribute('type');
    return enclosureObject;
  }
}

function feedParseFindEntryAuthor(entryElement) {
  const authorElement = feedParseFindChildElementByName(entryElement, 'author');
  if(authorElement) {
    const authorName = feedParseFindChildElementText(authorElement, 'name');
    if(authorName) {
      return authorName;
    }
  }

  const creator = feedParseFindChildElementText(entryElement, 'creator');
  if(creator) {
    return creator;
  }
  return feedParseFindChildElementText(entryElement, 'publisher');
}

function feedParseFindEntryLink(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let linkText;
  if(documentElement.localName.toLowerCase() === 'feed') {
    let link = feedParseFindChildElement(entryElement,
      feedParseIsLinkRelAltElement);
    link = link || feedParseFindChildElement(entryElement,
      feedParseIsLinkRelSelfElement);
    link = link || feedParseFindChildElement(entryElement,
      feedParseIsLinkWithHrefElement);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = feedParseFindChildElementText(entryElement, 'origlink');
    linkText = linkText || feedParseFindChildElementText(
      entryElement, 'link');
  }
  return linkText;
}

function feedParseFindEntryDate(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let dateString;
  if(documentElement.localName.toLowerCase() === 'feed') {
    dateString = feedParseFindChildElementText(entryElement, 'published') ||
      feedParseFindChildElementText(entryElement, 'updated');
  } else {
    dateString = feedParseFindChildElementText(entryElement, 'pubdate') ||
      feedParseFindChildElementText(entryElement, 'date');
  }
  if(!dateString) {
    return;
  }

  let entryDate;
  try {
    entryDate = new Date(dateString);
  } catch(exception) {
  }
  return entryDate;
}

function feedParseFindEntryContent(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let result;
  if(documentElement.localName.toLowerCase() === 'feed') {
    const content = feedParseFindChildElementByName(entryElement, 'content');
    const nodes = content ? content.childNodes : [];
    const texts = [];
    for(let node of nodes) {
      const nodeText = feedParseGetAtomNodeText(node);
      texts.push(nodeText);
    }

    result = texts.join('').trim();
  } else {
    result = feedParseFindChildElementText(entryElement, 'encoded');
    result = result || feedParseFindChildElementText(entryElement,
      'description');
    result = result || feedParseFindChildElementText(entryElement, 'summary');
  }
  return result;
}

function feedParseGetAtomNodeText(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function feedParseFindChildElement(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function feedParseFindChildElementByName(parent, name) {
  assert(parent instanceof Element);
  assert(typeof name === 'string');

  const normalName = name.toLowerCase();
  for(let child = parent.firstElementChild; child;
    child = child.nextElementSibling) {
    if(child.localName.toLowerCase() === normalName) {
      return child;
    }
  }
}

function feedParseFindChildElementText(parentElement, elementName) {
  const childElement = feedParseFindChildElementByName(parentElement,
    elementName);
  if(childElement) {
    const text = childElement.textContent;
    if(text) {
      return text.trim();
    }
  }
}
