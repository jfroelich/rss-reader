// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Returns an event-like object with properties feed and entries.
function parse_feed(document, exclude_entries) {
  console.assert(document, 'document is required');

  const doc_el = document.documentElement;
  if(!doc_el.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + doc_el.nodeName);
  }

  const channel = find_channel(doc_el);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = new Feed();

  feed.type = get_feed_type(doc_el);
  feed.title = find_child_element_text(channel, 'title');
  feed.description = find_child_element_text(channel,
    doc_el.matches('feed') ? 'subtitle' : 'description');
  feed.link = find_feed_link(channel);
  feed.datePublished = find_feed_date_published(channel);

  let entries = [];
  if(!exclude_entries) {
    const entry_els = find_entries(channel);
    for(let entry of entry_els) {
      entries.push(create_entry(feed.datePublished, entry));
    }
  }

  return {
    'feed': feed,
    'entries': entries
  };
}

function find_channel(doc_el) {
  if(doc_el.matches('feed')) {
    return doc_el;
  } else {
    return find_child_element_by_name(doc_el, 'channel');
  }
}

function find_entries(channel) {
  const doc_el = channel.ownerDocument.documentElement;
  const entries = [];
  let entry_parent;
  let entry_local_name;

  if(doc_el.matches('feed')) {
    entry_parent = doc_el;
    entry_local_name = 'entry';
  } else if(doc_el.matches('rdf')) {
    entry_parent = doc_el;
    entry_local_name = 'item';
  } else {
    entry_parent = channel;
    entry_local_name = 'item';
  }

  for(let element = entry_parent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName === entry_local_name) {
      entries.push(element);
    }
  }

  return entries;
}

function get_feed_type(doc_el) {
  let type = null;
  if(doc_el.matches('feed')) {
    type = 'feed';
  } else if(doc_el.matches('rdf')) {
    type = 'rdf';
  } else {
    type = 'rss';
  }
  return type;
}

function find_feed_date_published(channel) {
  const is_atom = channel.ownerDocument.documentElement.matches('feed');
  let date_text = null;
  if(is_atom) {
    date_text = find_child_element_text(channel, 'updated');
  } else {
    date_text = find_child_element_text(channel, 'pubdate') ||
      find_child_element_text(channel, 'lastbuilddate') ||
      find_child_element_text(channel, 'date');
  }

  if(date_text) {
    try {
      return new Date(date_text);
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
}

function is_link_rel_alt(element) {
  return element.matches('link[rel="alternate"]');
}

function is_link_rel_self(element) {
  return element.matches('link[rel="self"]');
}

function is_link_with_href(element) {
  return element.matches('link[href]');
}

function is_link_without_href(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function find_feed_link(channel) {
  const is_atom = channel.ownerDocument.documentElement.matches('feed');

  let link_text = null;
  let link_element = null;

  if(is_atom) {
    link_element = find_child_element(channel, is_link_rel_alt) ||
      find_child_element(channel, is_link_rel_self) ||
      find_child_element(channel, is_link_with_href);
    if(link_element) {
      link_text = link_element.getAttribute('href');
    }
  } else {
    link_element = find_child_element(channel, is_link_without_href);
    if(link_element) {
      link_text = link_element.textContent;
    } else {
      link_element = find_child_element(channel, is_link_with_href);
      if(link_element)
        link_text = link_element.getAttribute('href');
    }
  }

  if(link_text) {
    try {
      return new URL(link_text);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function create_entry(feedDatePublished, entry_el) {
  const is_atom = entry_el.ownerDocument.documentElement.matches('feed');

  const entry = new Entry();

  const title = find_child_element_text(entry_el, 'title');
  if(title) {
    entry.title = title;
  }

  const author = find_entry_author(entry_el);
  if(author) {
    entry.author = author;
  }

  // Set the link url as the entry's initial url
  const entry_link_url = find_entry_link(entry_el);
  if(entry_link_url) {
    entry.add_url(entry_link_url);
  }

  const entry_pub_date = find_entry_date_published(entry_el);
  if(entry_pub_date) {
    entry.datePublished = entry_pub_date;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entry.datePublished = feedDatePublished;
  } else {
    // TODO: actually i probably shouldn't infer this date and should leave it
    // as not set
    // Fall back to the current date
    entry.datePublished = new Date();
  }

  const content = find_entry_content(entry_el);
  if(content) {
    entry.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = find_child_element_by_name(entry_el,
    'enclosure');
  if(enclosure) {
    const enclosure_url_string = enclosure.getAttribute('url');
    let enclosure_url = null;
    if(enclosure_url_string) {
      try {
        enclosure_url = new URL(enclosure_url_string);
      } catch(exception) {
        console.debug(exception);
      }
    }

    entry.enclosure = {
      'url': enclosure_url,
      'enclosure_length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entry;
}

function find_entry_author(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  if(is_atom) {
    const author = find_child_element_by_name(entry, 'author');
    if(author) {
      return find_child_element_text(author, 'name');
    }
  } else {
    return find_child_element_text(entry, 'creator') ||
      find_child_element_text(entry, 'publisher');
  }
}

function find_entry_link(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  let link_text;
  let link_element;
  if(is_atom) {
    link_element = find_child_element(entry, is_link_rel_alt) ||
      find_child_element(entry, is_link_rel_self) ||
      find_child_element(entry, is_link_with_href);
    if(link_element) {
      link_text = link_element.getAttribute('href');
    }
  } else {
    link_text = find_child_element_text(entry, 'origlink') ||
      find_child_element_text(entry, 'link');
  }

  if(link_text) {
    try {
      return new URL(link_text);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function find_entry_date_published(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  let date_pub_str = null;

  if(is_atom) {
    date_pub_str = find_child_element_text(entry,
      'published') || find_child_element_text(entry, 'updated');
  } else {
    date_pub_str = find_child_element_text(entry, 'pubdate') ||
      find_child_element_text(entry, 'date');
  }

  if(date_pub_str) {
    date_pub_str = date_pub_str.trim();
  }

  if(date_pub_str) {
    try {
      return new Date(date_pub_str);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // If we did not find a valid date, then return null. Do not return today's
  // date or infer anything. This only parses the document as is.
  return null;
}

function find_entry_content(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(is_atom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = find_child_element_by_name(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, get_atom_node_text).join('').trim();
  } else {

    result = find_child_element_text(entry, 'encoded') ||
      find_child_element_text(entry, 'description') ||
      find_child_element_text(entry, 'summary');
  }
  return result;
}

function get_atom_node_text(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function find_child_element(parent_el, predicate) {
  for(let element = parent_el.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function find_child_element_by_name(parent_el, local_name) {

  function has_local_name(element) {
    return element.localName === local_name;
  }

  return find_child_element(parent_el, has_local_name);
}

function find_child_element_text(element, local_name) {
  const child = find_child_element_by_name(element, local_name);
  if(child) {
    const childText = child.textContent;
    if(childText) {
      return childText.trim();
    }
  }
}

this.parse_feed = parse_feed;

} // End file block scope
