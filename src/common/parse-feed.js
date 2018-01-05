import formatString from "/src/common/format-string.js";
import {decodeEntities} from "/src/common/html-utils.js";
import parseXML from "/src/common/parse-xml.js";
import * as Status from "/src/common/status.js";

// TODO: create a FeedDescriptor-like object and return it instead of a basic object?
// TODO: findChildElementText should not normalize, this should return values as is, and move
// normalization responsibility to caller. In fact nothing in this parser should do any
// normalization. All of that validation and sanitization and coercion should be the caller's
// responsibility. This function should not be concerned with those things. The goal is to maintain
// fidelity to the input. In fact I probably should not even be trying to change strings into
// date objects and such.

// Parses the input string into a feed object. The feed object will always have a defined entries
// array, although it may be zero length. Returns an array of status, feed, and error message.
export function parseFeed(xmlString) {
  if(typeof xmlString !== 'string') {
    throw new TypeError('Expected string, got ' + typeof xmlString);
  }

  const [status, document, message] = parseXML(xmlString);
  return status === Status.OK ? unmarshallXML(xmlDocument) : [status, null, message];
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a feed object
function unmarshallXML(document) {
  const documentElement = document.documentElement;
  const documentElementName = getElementName(documentElement);

  const supportedNames = ['feed', 'rdf', 'rss'];
  if(!supportedNames.includes(documentElementName)) {
    const message = formatString('Unsupported document element', documentElementName);
    return [Status.ERR_PARSE_FEED, null, message];
  }

  const channelElement = findChannelElement(documentElement);
  if(!channelElement) {
    const message = 'Missing channel element';
    return [Status.ERR_PARSE_FEED, null, message];
  }

  const feed = {};
  feed.type = findFeedType(documentElement);
  feed.title = findFeedTitle(channelElement);
  feed.description = findFeedDescription(document, channelElement);
  feed.link = findFeedLink(channelElement);
  feed.datePublished = findFeedDate(channelElement);

  const entryElements = findEntryElements(channelElement);
  feed.entries = entryElements.map(createEntryObject);

  return [Status.OK, feed];
}

function findFeedTitle(channelElement) {
  return findChildElementText(channelElement, 'title');
}

function findFeedDescription(document, channelElement) {
  const documentElement = document.documentElement;
  const documentElementName = documentElement.localName.toLowerCase();
  const elementName = documentElementName === 'feed' ? 'subtitle' : 'description';
  return findChildElementText(channelElement, elementName);
}

function findChannelElement(documentElement) {
  if(documentElement.localName.toLowerCase() === 'feed') {
    return documentElement;
  } else {
    return findChildElementByName(documentElement, 'channel');
  }
}

function findEntryElements(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);

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
    throw new Error('Should not have reached here');
  }

  const entries = [];
  for(let c = parentNode.firstElementChild; c; c = c.nextElementSibling) {
    if(getElementName(c) === entryElementName) {
      entries.push(c);
    }
  }
  return entries;
}

function findFeedType(documentElement) {
  return documentElement.localName.toLowerCase();
}

function findFeedDate(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const feedType = findFeedType(documentElement);

  let dateText;
  if(feedType === 'feed') {
    dateText = findChildElementText(channelElement, 'updated');
  } else {
    dateText = findChildElementText(channelElement, 'pubdate');
    dateText = dateText || findChildElementText(channelElement, 'lastbuilddate');
    dateText = dateText || findChildElementText(channelElement, 'date');
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
}

function findAtomFeedLinkElement(channelElement) {
  let linkElement = findChildElement(channelElement, isLinkRelAltElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, isLinkRelSelfElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, isLinkWithHrefElement);
  return linkElement;
}

function findFeedLink(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let linkText, linkElement;
  if(documentElementName === 'feed') {
    linkElement = findAtomFeedLinkElement(channelElement);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = findChildElement(channelElement, isLinkWithoutHrefElement);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = findChildElement(channelElement, isLinkWithHrefElement);
      if(linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    }
  }

  return linkText;
}

function isLinkRelAltElement(element) {
  return element.matches('link[rel="alternate"]');
}

function isLinkRelSelfElement(element) {
  return element.matches('link[rel="self"]');
}

function isLinkWithHrefElement(element) {
  return element.matches('link[href]');
}

function isLinkWithoutHrefElement(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function createEntryObject(entryElement) {
  return {
    title: findEntryTitle(entryElement),
    author: findEntryAuthor(entryElement),
    link: findEntryLink(entryElement),
    datePublished: findEntryDate(entryElement),
    content: findEntryContent(entryElement),
    enclosure: findEntryEnclosure(entryElement)
  };
}

function findEntryTitle(entryElement) {
  return findChildElementText(entryElement, 'title');
}

function findEntryEnclosure(entryElement) {
  const enclosureElement = findChildElementByName(entryElement, 'enclosure');

  if(enclosureElement) {
    const enclosureObject = {};
    enclosureObject.url = enclosureElement.getAttribute('url');
    enclosureObject.enclosureLength = enclosureElement.getAttribute('length');
    enclosureObject.type = enclosureElement.getAttribute('type');
    return enclosureObject;
  }
}

function findEntryAuthor(entryElement) {
  const authorElement = findChildElementByName(entryElement, 'author');
  if(authorElement) {
    const authorName = findChildElementText(authorElement, 'name');
    if(authorName) {
      return authorName;
    }
  }

  const creator = findChildElementText(entryElement, 'creator');
  if(creator) {
    return creator;
  }
  return findChildElementText(entryElement, 'publisher');
}

function findEntryLink(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let linkText;
  if(documentElementName === 'feed') {
    let link = findChildElement(entryElement, isLinkRelAltElement);
    link = link || findChildElement(entryElement, isLinkRelSelfElement);
    link = link || findChildElement(entryElement, isLinkWithHrefElement);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = findChildElementText(entryElement, 'origlink');
    linkText = linkText || findChildElementText(entryElement, 'link');
  }
  return linkText;
}

function findEntryDate(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let dateString;
  if(documentElementName === 'feed') {
    dateString = findChildElementText(entryElement, 'published') ||
      findChildElementText(entryElement, 'updated');
  } else {
    dateString = findChildElementText(entryElement, 'pubdate') ||
      findChildElementText(entryElement, 'date');
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

function findEntryContent(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let result;
  if(documentElementName === 'feed') {
    const content = findChildElementByName(entryElement, 'content');

    if(!content) {
      return;
    }

    // NOTE: so I think I handle cdata content correctly, but note the issue with title
    // still having raw entities. Or, rather, should content be not encoded in any situation?

    const nodes = content.childNodes;
    const texts = [];
    for(let node of nodes) {
      if(node.nodeType === Node.CDATA_SECTION_NODE) {
        let nodeValue = node.nodeValue;
        nodeValue = decodeEntities(nodeValue);
        //console.debug('nodeValue (encoded)', nodeValue);
        texts.push(nodeValue);
      } else if(node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent;
        //console.debug('textContent', nodeText);
        texts.push(nodeText);
      } else {
        console.warn('Unknown node type, next message is dir inspection');
        console.dir(node);
      }
    }

    result = texts.join('').trim();
  } else {
    result = findChildElementText(entryElement, 'encoded');
    result = result || findChildElementText(entryElement, 'description');
    result = result || findChildElementText(entryElement, 'summary');
  }
  return result;
}

function findChildElement(parentElement, predicate) {
  for(let e = parentElement.firstElementChild; e; e = e.nextElementSibling) {
    if(predicate(e)) {
      return e;
    }
  }
}

function findChildElementByName(parent, name) {
  if(!(parent instanceof Element)) {
    throw new TypeError('Expected element, got ' + typeof Element);
  }

  if(typeof name !== 'string') {
    throw new TypeError('Expected string, got ' + typeof name);
  }


  const normalName = name.toLowerCase();
  for(let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if(c.localName.toLowerCase() === normalName) {
      return c;
    }
  }
}

function findChildElementText(parentElement, elementName) {
  const childElement = findChildElementByName(parentElement, elementName);
  if(childElement) {
    const text = childElement.textContent;
    if(text) {

      return text.trim();
    }
  }
}

function getElementName(element) {
  return element.localName.toLowerCase();
}
