// See license.md

'use strict';

// Parses the input string into a feed object
// @param string {String} the text to parse
// @returns {Object} an object representing the parsed feed and its entries
function parseFeed(string) {
  const documentObject = parseXML(string);
  const feedObject = coerceFeed(documentObject);
  return feedObject;


  // PRIVATE HELPER FUNCTIONS

  // Parse a string containing xml into an XML document
  // Throws if there is a parsing error
  function parseXML(string) {
    const parser = new DOMParser();
    const documentObject = parser.parseFromString(string, 'application/xml');

    // parseFromString doesn't actually throw. Instead it includes error text
    // within a default document template. Find it and throw it.
    const errorElement = documentObject.querySelector('parsererror');
    if(errorElement) {
      throw new Error(errorElement.textContent);
    }
    return documentObject;
  }

  // Convert an XML Document object representing a feed into a basic object
  // @param documentObject {Document} an XML document representing a feed
  // @returns {Object} a simple object representing a feed
  function coerceFeed(documentObject) {
    const documentElement = documentObject.documentElement;
    const name = documentElement.localName.toLowerCase();
    if(name !== 'feed' && name !== 'rss' && name !== 'rdf') {
      throw new Error('Invalid document element');
    }

    const channelElement = findChannelElement(documentElement);
    if(!channelElement) {
      throw new Error('Missing channel element');
    }

    // TODO: be more explicit about what is returned
    // TODO: avoid use of map and such. be more explicit about the objects used

    const feedObject = {};
    feedObject.type = findFeedType(documentElement);
    feedObject.title = findFeedTitle(channelElement);
    feedObject.description =
      findFeedDescription(documentObject, channelElement);
    feedObject.link = findFeedLink(channelElement);
    feedObject.datePublished = findFeedDate(channelElement);

    feedObject.entries = [];
    const entryElementArray = findEntryElements(channelElement);
    for(let entryElement of entryElementArray) {
      const entryObject = createEntry(entryElement);
      feedObject.entries.push(entryObject);
    }

    return feedObject;
  }

  function findFeedTitle(channelElement) {
    return findChildText(channelElement, 'title');
  }

  function findFeedDescription(documentObject, channelElement) {
    const documentElement = documentObject.documentElement;
    const rootName = documentElement.localName.toLowerCase();
    const elementName = rootName === 'feed' ? 'subtitle' : 'description';
    return findChildText(channelElement, elementName);
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
    const rootName = documentElement.localName.toLowerCase();
    const entriesArray = [];
    let parentNode, name;

    if(rootName === 'feed') {
      parentNode = documentElement;
      name = 'entry';
    } else if(rootName === 'rdf') {
      parentNode = documentElement;
      name = 'item';
    } else if(rootName === 'rss') {
      parentNode = channelElement;
      name = 'item';
    } else {
      throw new Error(
        `Unsupported document element ${documentElement.nodeName}`);
    }

    for(let childElement = parentNode.firstElementChild; childElement;
      childElement = childElement.nextElementSibling) {
      if(childElement.localName.toLowerCase() === name) {
        entriesArray.push(childElement);
      }
    }

    return entriesArray;
  }

  function findFeedType(documentElement) {
    return documentElement.localName.toLowerCase();
  }

  function findFeedDate(channelElement) {
    const documentElement = channelElement.ownerDocument.documentElement;
    const feedType = findFeedType(documentElement);

    let dateText;
    if(feedType === 'feed') {
      dateText = findChildText(channelElement, 'updated');
    } else {
      dateText = findChildText(channelElement, 'pubdate');
      dateText = dateText || findChildText(channelElement, 'lastbuilddate');
      dateText = dateText || findChildText(channelElement, 'date');
    }

    if(!dateText) {
      return;
    }

    let dateObject;
    try {
      dateObject = new Date(dateText);
    } catch(error) {
      // console.warn(error);
    }
    return dateObject;
  }

  function findFeedLink(channelElement) {
    const documentElement = channelElement.ownerDocument.documentElement;

    let linkText, linkElement;
    if(documentElement.localName.toLowerCase() === 'feed') {
      linkElement = findChildElement(channelElement, isLinkRelAlt);
      linkElement = linkElement ||
        findChildElement(channelElement, isLinkRelSelf);
      linkElement = linkElement ||
        findChildElement(channelElement, isLinkWithHref);
      if(linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    } else {
      linkElement = findChildElement(channelElement, isLinkWithoutHref);
      if(linkElement) {
        linkText = linkElement.textContent;
      } else {
        linkElement = findChildElement(channelElement, isLinkWithHref);
        if(linkElement) {
          linkText = linkElement.getAttribute('href');
        }
      }
    }

    return linkText;
  }

  function isLinkRelAlt(element) {
    return element.matches('link[rel="alternate"]');
  }

  function isLinkRelSelf(element) {
    return element.matches('link[rel="self"]');
  }

  function isLinkWithHref(element) {
    return element.matches('link[href]');
  }

  function isLinkWithoutHref(element) {
    return element.localName === 'link' && !element.hasAttribute('href');
  }

  function createEntry(entryElement) {
    return {
      'title': findEntryTitle(entryElement),
      'author': findEntryAuthor(entryElement),
      'link': findEntryLink(entryElement),
      'datePublished': findEntryDate(entryElement),
      'content': findEntryContent(entryElement),
      'enclosure': findEntryEnclosure(entryElement)
    };
  }

  function findEntryTitle(entryElement) {
    return findChildText(entryElement, 'title');
  }

  function findEntryEnclosure(entryElement) {
    const enclosureElement = findChildElementByName(entryElement, 'enclosure');

    if(enclosureElement) {
      const enclosureObject = {};
      enclosureObject.url = enclosureElement.getAttribute('url');
      // Cannot use property 'length'
      // TODO: rename to use camel case
      enclosureObject.enclosureLength = enclosureElement.getAttribute('length');
      enclosureObject.type = enclosureElement.getAttribute('type');
      return enclosureObject;
    }
  }

  function findEntryAuthor(entryElement) {
    const author = findChildElementByName(entryElement, 'author');
    if(author) {
      const name = findChildText(author, 'name');
      if(name) {
        return name;
      }
    }

    const creator = findChildText(entryElement, 'creator');
    if(creator) {
      return creator;
    }

    return findChildText(entryElement, 'publisher');
  }

  function findEntryLink(entryElement) {
    const documentElement = entryElement.ownerDocument.documentElement;
    let linkText;
    if(documentElement.localName.toLowerCase() === 'feed') {
      let link = findChildElement(entryElement, isLinkRelAlt);
      link = link || findChildElement(entryElement, isLinkRelSelf);
      link = link || findChildElement(entryElement, isLinkWithHref);
      linkText = link ? link.getAttribute('href') : undefined;
    } else {
      linkText = findChildText(entryElement, 'origlink');
      linkText = linkText || findChildText(entryElement, 'link');
    }
    return linkText;
  }

  function findEntryDate(entryElement) {
    const documentElement = entryElement.ownerDocument.documentElement;
    let dateString;
    if(documentElement.localName.toLowerCase() === 'feed') {
      dateString = findChildText(entryElement, 'published') ||
        findChildText(entryElement, 'updated');
    } else {
      dateString = findChildText(entryElement, 'pubdate') ||
        findChildText(entryElement, 'date');
    }
    if(!dateString) {
      return;
    }

    let dateObject;
    try {
      dateObject = new Date(dateString);
    } catch(exception) {
      console.warn(exception);
    }

    return dateObject;
  }

  function findEntryContent(entryElement) {
    const documentElement = entryElement.ownerDocument.documentElement;
    let result;
    if(documentElement.localName.toLowerCase() === 'feed') {
      const content = findChildElementByName(entryElement, 'content');
      const nodes = content ? content.childNodes : [];

      const texts = new Array(nodes.length);
      for(let node of nodes) {
        const nodeText = getAtomNodeText(node);
        texts.push(nodeText);
      }

      result = texts.join('').trim();
    } else {
      result = findChildText(entryElement, 'encoded');
      result = result || findChildText(entryElement, 'description');
      result = result || findChildText(entryElement, 'summary');
    }
    return result;
  }

  function getAtomNodeText(node) {
    return node.nodeType === Node.ELEMENT_NODE ?
      node.innerHTML : node.textContent;
  }

  function findChildElement(parentNode, predicate) {
    for(let element = parentNode.firstElementChild; element;
      element = element.nextElementSibling) {
      if(predicate(element)) {
        return element;
      }
    }
  }

  function findChildElementByName(parentNode, name) {
    const lowerName = name.toLowerCase();
    for(let element = parentNode.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.localName.toLowerCase() === lowerName) {
        return element;
      }
    }
  }

  function findChildText(parentNode, name) {
    const childElement = findChildElementByName(parentNode, name);
    if(childElement) {
      const childText = childElement.textContent;
      if(childText) {
        return childText.trim();
      }
    }
  }
}
