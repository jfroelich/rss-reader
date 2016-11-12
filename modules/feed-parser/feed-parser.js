// See license.md

'use strict';

// TODO: fully decouple from everything. This means I should not care about how
// this output is consumed. I should only care about correctness of output here
// and repeatability, reusability, and testability.

class FeedParser {

  // Parses the input string into a feed object and an entries object
  // @param string {String} the text to parse
  // @returns {Object} an object representing the parsed feed and its entries
  static parseFromString(string) {
    const doc = this.parseXML(string);
    return this.domToFeed(doc);
  }

  // Parse the string into an XML document
  // Throws if there is a parsing error
  static parseXML(string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(string, 'application/xml');
    const error = doc.querySelector('parsererror');
    if(error)
      throw new Error(error.textContent);
    return doc;
  }

  // Returns a basic object representing a feed. Throws an error if the doc
  // is not a feed.
  // @param doc {Document} an XML document
  static domToFeed(doc) {
    const name = doc.documentElement.localName.toLowerCase();
    if(name !== 'feed' && name !== 'rss' && name !== 'rdf')
      throw new Error('Invalid document element');
    const channel = this.findChannel(doc.documentElement);
    if(!channel)
      throw new Error('Missing channel element');
    return {
      'type': this.findFeedType(doc.documentElement),
      'title': this.findFeedTitle(channel),
      'description': this.findFeedDesc(doc, channel),
      'link': this.findFeedLink(channel),
      'datePublished': this.findFeedDate(channel),
      'entries': this.findEntries(channel).map(this.createEntry, this)
    };
  }

  static findFeedTitle(channel) {
    return this.findChildText(channel, 'title');
  }

  static findFeedDesc(doc, channel) {
    const docElement = doc.documentElement;
    const name = docElement.localName.toLowerCase() === 'feed' ?
      'subtitle' : 'description';
    return this.findChildText(channel, name);
  }

  static findChannel(docElement) {
    if(docElement.matches('feed'))
      return docElement;
    else
      return this.findChildByName(docElement, 'channel');
  }

  static findEntries(channel) {
    const docElement = channel.ownerDocument.documentElement;
    const entries = [];
    let parent;
    let name;

    if(docElement.matches('feed')) {
      parent = docElement;
      name = 'entry';
    } else if(docElement.matches('rdf')) {
      parent = docElement;
      name = 'item';
    } else {
      parent = channel;
      name = 'item';
    }

    for(let e = parent.firstElementChild; e; e = e.nextElementSibling) {
      if(e.localName === name)
        entries.push(e);
    }

    return entries;
  }

  static findFeedType(docElement) {
    return docElement.localName.toLowerCase();
  }

  static findFeedDate(channel) {
    const docElement = channel.ownerDocument.documentElement;
    let dateText;
    if(docElement.localName.toLowerCase() === 'feed') {
      dateText = this.findChildText(channel, 'updated');
    } else {
      dateText = this.findChildText(channel, 'pubdate');
      dateText = dateText || this.findChildText(channel, 'lastbuilddate');
      dateText = dateText || this.findChildText(channel, 'date');
    }

    if(!dateText)
      return;
    try {
      return new Date(dateText);
    } catch(error) {
      console.warn(error);
    }
  }

  static findFeedLink(channel) {
    const docElement = channel.ownerDocument.documentElement;
    let linkText, linkElement;
    if(docElement.localName.toLowerCase() === 'feed') {
      linkElement = this.findChild(channel, this.isLinkRelAlt) ||
        this.findChild(channel, this.isLinkRelSelf) ||
        this.findChild(channel, this.isLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    } else {
      linkElement = this.findChild(channel, this.isLinkWithoutHref);
      if(linkElement) {
        linkText = linkElement.textContent;
      } else {
        linkElement = this.findChild(channel, this.isLinkWithHref);
        if(linkElement)
          linkText = linkElement.getAttribute('href');
      }
    }

    return linkText;
  }

  static isLinkRelAlt(element) {
    return element.matches('link[rel="alternate"]');
  }

  static isLinkRelSelf(element) {
    return element.matches('link[rel="self"]');
  }

  static isLinkWithHref(element) {
    return element.matches('link[href]');
  }

  static isLinkWithoutHref(element) {
    return element.localName === 'link' && !element.hasAttribute('href');
  }

  static createEntry(entry) {
    return {
      'title': this.findEntryTitle(entry),
      'author': this.findEntryAuthor(entry),
      'link': this.findEntryLink(entry),
      'datePublished': this.findEntryDate(entry),
      'content': this.findEntryContent(entry),
      'enclosure': this.findEntryEnclosure(entry)
    };
  }

  static findEntryTitle(entry) {
    return this.findChildText(entry, 'title');
  }

  static findEntryEnclosure(entry) {
    const enclosure = this.findChildByName(entry, 'enclosure');
    if(!enclosure)
      return;
    return {
      'url': enclosure.getAttribute('url'),
      'enclosure_length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  static findEntryAuthor(entry) {
    const author = this.findChildByName(entry, 'author');
    if(author) {
      const name = this.findChildText(author, 'name');
      if(name)
        return name;
    }

    const creator = this.findChildText(entry, 'creator');
    if(creator)
      return creator;
    return this.findChildText(entry, 'publisher');
  }

  static findEntryLink(entry) {
    const docElement = entry.ownerDocument.documentElement;
    let linkText;
    if(docElement.localName.toLowerCase() === 'feed') {
      let link = this.findChild(entry, isLinkRelAlt);
      link = link || this.findChild(entry, isLinkRelSelf);
      link = link || this.findChild(entry, isLinkWithHref);
      linkText = link ? link.getAttribute('href') : undefined;
    } else {
      linkText = this.findChildText(entry, 'origlink');
      linkText = linkText || this.findChildText(entry, 'link');
    }
    return linkText;
  }

  static findEntryDate(entry) {
    const docElement = entry.ownerDocument.documentElement;
    let dateStr;
    if(docElement.localName.toLowerCase() === 'feed')
      dateStr = this.findChildText(entry, 'published') ||
        this.findChildText(entry, 'updated');
    else
      dateStr = this.findChildText(entry, 'pubdate') ||
        this.findChildText(entry, 'date');
    if(!dateStr)
      return;
    try {
      return new Date(dateStr);
    } catch(exception) {
      console.warn(exception);
    }
  }

  static findEntryContent(entry) {
    const docElement = entry.ownerDocument.documentElement;
    let result;
    if(docElement.matches('feed')) {
      const content = this.findChildByName(entry, 'content');
      const nodes = content ? content.childNodes : [];
      const map = Array.prototype.map;
      result = map.call(nodes, this.getAtomNodeText).join('').trim();
    } else {
      result = this.findChildText(entry, 'encoded');
      result = result || this.findChildText(entry, 'description');
      result = result || this.findChildText(entry, 'summary');
    }
    return result;
  }

  static getAtomNodeText(node) {
    return node.nodeType === Node.ELEMENT_NODE ?
      node.innerHTML : node.textContent;
  }

  static findChild(parent, predicate) {
    for(let el = parent.firstElementChild; el; el = el.nextElementSibling) {
      if(predicate(el))
        return el;
    }
  }

  static findChildByName(parent, name) {
    const lowerName = name.toLowerCase();
    for(let el = parent.firstElementChild; el; el = el.nextElementSibling) {
      if(el.localName.toLowerCase() === lowerName) {
        return el;
      }
    }
  }

  static findChildText(element, name) {
    const child = this.findChildByName(element, name);
    const text = child ? child.textContent : null;
    return text ? text.trim() : null;
  }
}
