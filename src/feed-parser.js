// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// No dependencies

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

  const channel = FeedParser.getChannelElement(documentElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = FeedParser.getFeedType(documentElement);
  feed.title = FeedParser.findText(channel, 'title');
  feed.description = FeedParser.findText(channel,
    documentElement.matches('feed') ? 'subtitle' : 'description');
  feed.date = FeedParser.getFeedDate(channel);
  feed.link = FeedParser.getFeedLink(channel);
  feed.entries = FeedParser.getEntryElements(channel).map(
    FeedParser.parseEntry);
  return feed;
};

FeedParser.getEntryElements = function(channel) {
  'use strict';
  const entries = [];
  let entryParent;
  let entryLocalName;
  const documentElement = channel.ownerDocument.documentElement;

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
  'use strict';
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

FeedParser.getFeedDate = function(channel) {
  'use strict';
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    return FeedParser.findText(channel, 'updated');
  } else {
    return FeedParser.findText(channel, 'pubdate') ||
      FeedParser.findText(channel, 'lastbuilddate') ||
      FeedParser.findText(channel, 'date');
  }
};

FeedParser.getFeedLink = function(channel) {
  'use strict';
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
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
    return linkText.trim();
  }
};

FeedParser.getChannelElement = function(documentElement) {
  'use strict';
  return documentElement.matches('feed') ? documentElement :
    FeedParser.findChildElementByName(documentElement, 'channel');
};

FeedParser.parseEntry = function(entry) {
  'use strict';

  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  const getText = FeedParser.getElementText;
  const result = {};
  result.title = FeedParser.findText(entry, 'title');

  // TODO: because i no longer replaceHTML, the caller has to do it somewhere
  //result.author = utils.replaceHTML(author, ' ');
  result.author = FeedParser.getEntryAuthor(entry);
  result.link = FeedParser.getEntryLink(entry);
  result.pubdate = FeedParser.getEntryPubDate(entry);
  result.content = FeedParser.getEntryContent(entry);

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

FeedParser.getEntryAuthor = function(entry) {
  'use strict';
  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  if(isAtom) {
    const author = FeedParser.findChildElementByName(entry, 'author');
    if(author) {
      return FeedParser.findText(author, 'name');
    }
  } else {
    return FeedParser.findText(entry, 'creator') ||
      FeedParser.findText(entry, 'publisher');
  }
};

FeedParser.getEntryLink = function(entry) {
  'use strict';

  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  const isLinkRelAlternate = function(element) {
    return element.localname === 'link' &&
      element.getAttribute('rel') === 'alternate';
  };

  const isLinkRelSelf = function(element) {
    return element.localName === 'link' &&
      element.getAttribute('rel') === 'self';
  };

  const isLinkWithHref = function(element) {
    return element.localName === 'link' && element.hasAttribute('href');
  };

  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = FeedParser.findChildElement(entry, isLinkRelAlternate) ||
      FeedParser.findChildElement(entry, isLinkRelSelf) ||
      FeedParser.findChildElement(entry, isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = FeedParser.findText(entry, 'origlink') ||
      FeedParser.findText(entry, 'link');
  }
  if(linkText) {
    linkText = linkText.trim();
  }
  return linkText;
};

FeedParser.getEntryPubDate = function(entry) {
  'use strict';
  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  let dateText;
  if(isAtom) {
    dateText = FeedParser.findText(entry, 'published') ||
      FeedParser.findText(entry, 'updated');
  } else {
    dateText = FeedParser.findText(entry, 'pubdate') ||
      FeedParser.findText(entry, 'date');
  }
  if(dateText) {
    dateText = date.trim();
  }
  return dateText;
};

FeedParser.getEntryContent = function(entry) {
  'use strict';
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;

  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = FeedParser.findChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, function(node) {
      return node.nodeType === Node.ELEMENT_NODE ?
        node.innerHTML : node.textContent;
    }).join('').trim();
  } else {
    result = FeedParser.findText(entry, 'encoded') ||
      FeedParser.findText(entry, 'description') ||
      FeedParser.findText(entry, 'summary');
  }
  return result;
};

FeedParser.findChildElement = function(parentElement, predicate) {
  'use strict';
  for(let element = parentElement.firstElementChild; element;
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
// DEPRECATED
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
