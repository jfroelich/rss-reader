
import {assert} from "/src/assert.js";
import {parseXML} from "/src/xml-parser.js";

// TODO: prefer "item" over "entry" terminology?
// TODO: there is no need for class with modules

export class FeedParser {}

// Parses the input string into a feed object
// @param xml {String} the text to parse
// @throws {AssertionError}
// @returns {Object} an object representing the parsed feed and its entries
FeedParser.prototype.parseFromString = function(feedXML) {
  const xmlDocument = parseXML(feedXML);
  return this.unmarshallXML(xmlDocument);
};

// @param document {Document} an XML document representing a feed
// @returns {Object} a simple object with properties feed and entries
FeedParser.prototype.unmarshallXML = function(document) {
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

  const channelElement = this.findChannelElement(documentElement);
  if(!channelElement) {
    return emptyResult;
  }

  // TODO: this should be creating some kind of ParsedFeed object

  const feed = {};
  feed.type = this.findFeedType(documentElement);
  feed.title = this.findFeedTitle(channelElement);
  feed.description = this.findFeedDescription(document, channelElement);
  feed.link = this.findFeedLink(channelElement);
  feed.datePublished = this.findFeedDate(channelElement);

  const entryObjects = [];
  const entryElements = this.findEntryElements(channelElement);
  for(const entryElement of entryElements) {
    entryObjects.push(this.createEntryObject(entryElement));
  }

  const result = {};
  result.feed = feed;
  result.entries = entryObjects;
  return result;
};

FeedParser.prototype.findFeedTitle = function(channelElement) {
  return this.findChildElementText(channelElement, 'title');
};

FeedParser.prototype.findFeedDescription = function(document, channelElement) {
  const documentElement = document.documentElement;
  const documentElementName = documentElement.localName.toLowerCase();
  const elementName = documentElementName === 'feed' ? 'subtitle' : 'description';
  return this.findChildElementText(channelElement, elementName);
};

FeedParser.prototype.findChannelElement = function(documentElement) {
  if(documentElement.localName.toLowerCase() === 'feed') {
    return documentElement;
  } else {
    return this.findChildElementByName(documentElement, 'channel');
  }
};

FeedParser.prototype.findEntryElements = function(channelElement) {
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
    // TODO: use a custom error here
    throw new Error(`Invalid document element ${documentElement.nodeName}`);
  }

  for(let childElement = parentNode.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    if(childElement.localName.toLowerCase() === entryElementName) {
      entries.push(childElement);
    }
  }

  return entries;
};

FeedParser.prototype.findFeedType = function(documentElement) {
  return documentElement.localName.toLowerCase();
};

FeedParser.prototype.findFeedDate = function(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const feedType = this.findFeedType(documentElement);

  let dateText;
  if(feedType === 'feed') {
    dateText = this.findChildElementText(channelElement, 'updated');
  } else {
    dateText = this.findChildElementText(channelElement, 'pubdate');
    dateText = dateText || this.findChildElementText(channelElement, 'lastbuilddate');
    dateText = dateText || this.findChildElementText(channelElement, 'date');
  }

  if(!dateText) {
    return;
  }

  let feedDate;
  try {
    feedDate = new Date(dateText);
  } catch(error) {
  }

  return feedDate;
};

FeedParser.prototype.findAtomFeedLinkElement = function(channelElement) {
  let linkElement = this.findChildElement(channelElement, this.isLinkRelAltElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = this.findChildElement(channelElement, this.isLinkRelSelfElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = this.findChildElement(channelElement, this.isLinkWithHrefElement);
  return linkElement;
};

FeedParser.prototype.findFeedLink = function(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;

  let linkText, linkElement;
  if(documentElement.localName.toLowerCase() === 'feed') {
    linkElement = this.findAtomFeedLinkElement(channelElement);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = this.findChildElement(channelElement, this.isLinkWithoutHrefElement);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = this.findChildElement(channelElement, this.isLinkWithHrefElement);
      if(linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    }
  }

  return linkText;
};

FeedParser.prototype.isLinkRelAltElement = function(element) {
  return element.matches('link[rel="alternate"]');
};

FeedParser.prototype.isLinkRelSelfElement = function(element) {
  return element.matches('link[rel="self"]');
};

FeedParser.prototype.isLinkWithHrefElement = function(element) {
  return element.matches('link[href]');
};

FeedParser.prototype.isLinkWithoutHrefElement = function(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
};

FeedParser.prototype.createEntryObject = function(entryElement) {
  return {
    title: this.findEntryTitle(entryElement),
    author: this.findEntryAuthor(entryElement),
    link: this.findEntryLink(entryElement),
    datePublished: this.findEntryDate(entryElement),
    content: this.findEntryContent(entryElement),
    enclosure: this.findEntryEnclosure(entryElement)
  };
};

FeedParser.prototype.findEntryTitle = function(entryElement) {
  return this.findChildElementText(entryElement, 'title');
};

FeedParser.prototype.findEntryEnclosure = function(entryElement) {
  const enclosureElement = this.findChildElementByName(entryElement, 'enclosure');

  if(enclosureElement) {
    const enclosureObject = {};
    enclosureObject.url = enclosureElement.getAttribute('url');
    enclosureObject.enclosureLength = enclosureElement.getAttribute('length');
    enclosureObject.type = enclosureElement.getAttribute('type');
    return enclosureObject;
  }
};

FeedParser.prototype.findEntryAuthor = function(entryElement) {
  const authorElement = this.findChildElementByName(entryElement, 'author');
  if(authorElement) {
    const authorName = this.findChildElementText(authorElement, 'name');
    if(authorName) {
      return authorName;
    }
  }

  const creator = this.findChildElementText(entryElement, 'creator');
  if(creator) {
    return creator;
  }
  return this.findChildElementText(entryElement, 'publisher');
};

FeedParser.prototype.findEntryLink = function(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let linkText;
  if(documentElement.localName.toLowerCase() === 'feed') {
    let link = this.findChildElement(entryElement, this.isLinkRelAltElement);
    link = link || this.findChildElement(entryElement, this.isLinkRelSelfElement);
    link = link || this.findChildElement(entryElement, this.isLinkWithHrefElement);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = this.findChildElementText(entryElement, 'origlink');
    linkText = linkText || this.findChildElementText(entryElement, 'link');
  }
  return linkText;
};

FeedParser.prototype.findEntryDate = function(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let dateString;
  if(documentElement.localName.toLowerCase() === 'feed') {
    dateString = this.findChildElementText(entryElement, 'published') ||
      this.findChildElementText(entryElement, 'updated');
  } else {
    dateString = this.findChildElementText(entryElement, 'pubdate') ||
      this.findChildElementText(entryElement, 'date');
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
};

FeedParser.prototype.findEntryContent = function(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  let result;
  if(documentElement.localName.toLowerCase() === 'feed') {
    const content = this.findChildElementByName(entryElement, 'content');
    const nodes = content ? content.childNodes : [];
    const texts = [];
    for(let node of nodes) {
      const nodeText = this.getAtomNodeText(node);
      texts.push(nodeText);
    }

    result = texts.join('').trim();
  } else {
    result = this.findChildElementText(entryElement, 'encoded');
    result = result || this.findChildElementText(entryElement, 'description');
    result = result || this.findChildElementText(entryElement, 'summary');
  }
  return result;
};

FeedParser.prototype.getAtomNodeText = function(node) {
  return node.nodeType === Node.ELEMENT_NODE ? node.innerHTML : node.textContent;
};

FeedParser.prototype.findChildElement = function(parentElement, predicate) {
  for(let e = parentElement.firstElementChild; e; e = e.nextElementSibling) {
    if(predicate(e)) {
      return e;
    }
  }
};

FeedParser.prototype.findChildElementByName = function(parent, name) {
  assert(parent instanceof Element);
  assert(typeof name === 'string');

  const normalName = name.toLowerCase();
  for(let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if(c.localName.toLowerCase() === normalName) {
      return c;
    }
  }
};

FeedParser.prototype.findChildElementText = function(parentElement, elementName) {
  const childElement = this.findChildElementByName(parentElement, elementName);
  if(childElement) {
    const text = childElement.textContent;
    if(text) {
      // TODO: I shouldn't normalize, this should return values as is, and
      // move normalization responsibility to caller.
      return text.trim();
    }
  }
};
