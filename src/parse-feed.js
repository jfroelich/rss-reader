// See license.md

/*
TODO:
- support <media:thumbnail url="imgurl" /> (atom)
- do not introduce fallback dates, if date is not set then do not use
- do not cascade feed date to entry date
- add helper for entry enclosure instead of how it is inlined
- figure out the atom text node issue (cdata related?)
- setup testing
- maybe rename, this does not parse from text, it unmarshals from a doc.
-- on the other hand, i no longer get a doc when using the fetch api, maybe
-- this should accept text as input?
- maybe return [feed,entries] so i can use new expanding ES6 syntax thing
- walking children seems to be slower than querySelector, revert to using it,
but think of a way to maintain strictness
*/

'use strict';

{

// Returns an event-like object with properties feed and entries. Throws an
// error if parsing failed
// @param doc {Document} an XML document
function parse_feed(doc) {
  if(!doc.documentElement.matches('feed, rss, rdf'))
    throw new Error(
      `Unsupported document element ${doc.documentElement.nodeName}`);

  const channel = find_channel(doc.documentElement);
  if(!channel)
    throw new Error('Missing channel element');

  const feed = {};
  feed.type = find_feed_type(doc.documentElement);
  feed.title = find_child_text(channel, 'title');
  feed.description = find_child_text(channel,
    doc.documentElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = find_feed_link(channel);
  feed.datePublished = find_feed_date(channel);

  const entries = [];
  const entry_els = find_entries(channel);
  for(let entry of entry_els) {
    entries.push(create_entry(feed.datePublished, entry));
  }

  return {
    'feed': feed,
    'entries': entries
  };
}

function find_channel(doc_element) {
  if(doc_element.matches('feed'))
    return doc_element;
  else
    return find_child_by_name(doc_element, 'channel');
}

function find_entries(channel) {
  const doc_element = channel.ownerDocument.documentElement;
  const entries = [];
  let parent;
  let name;

  if(doc_element.matches('feed')) {
    parent = doc_element;
    name = 'entry';
  } else if(doc_element.matches('rdf')) {
    parent = doc_element;
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

function find_feed_type(doc_element) {
  let type = null;
  if(doc_element.matches('feed'))
    type = 'feed';
  else if(doc_element.matches('rdf'))
    type = 'rdf';
  else
    type = 'rss';
  return type;
}

function find_feed_date(channel) {
  const is_atom = channel.ownerDocument.documentElement.matches('feed');
  let date_text = null;
  if(is_atom) {
    date_text = find_child_text(channel, 'updated');
  } else {
    date_text = find_child_text(channel, 'pubdate') ||
      find_child_text(channel, 'lastbuilddate') ||
      find_child_text(channel, 'date');
  }

  if(date_text)
    try {
      return new Date(date_text);
    } catch(exception) {
      console.debug(exception);
    }

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
    link_element = find_child(channel, is_link_rel_alt) ||
      find_child(channel, is_link_rel_self) ||
      find_child(channel, is_link_with_href);
    if(link_element)
      link_text = link_element.getAttribute('href');
  } else {
    link_element = find_child(channel,
      is_link_without_href);
    if(link_element) {
      link_text = link_element.textContent;
    } else {
      link_element = find_child(channel, is_link_with_href);
      if(link_element)
        link_text = link_element.getAttribute('href');
    }
  }

  if(link_text)
    try {
      return new URL(link_text).href;
    } catch(error) {
      console.debug(error);
    }
}

function create_entry(feed_date, entry_element) {
  const is_atom = entry_element.ownerDocument.documentElement.matches('feed');
  const entry = {};
  const title = find_child_text(entry_element, 'title');
  if(title)
    entry.title = title;

  const author = find_entry_author(entry_element);
  if(author)
    entry.author = author;

  // Set the link url as the entry's initial url
  const entry_link_url = find_entry_link(entry_element);
  if(entry_link_url)
    add_entry_url(entry, entry_link_url);

  const entry_date = find_entry_date(entry_element);
  if(entry_date)
    entry.datePublished = entry_date;
  else if(feed_date)
    // Fall back to the feed's date
    entry.datePublished = feed_date;
  else
    entry.datePublished = new Date();

  const content = find_entry_content(entry_element);
  if(content)
    entry.content = content;

  const enclosure = find_child_by_name(entry_element, 'enclosure');
  if(enclosure) {
    const enc_url_str = enclosure.getAttribute('url');
    let enc_url = null;
    if(enc_url_str)
      try {
        enc_url = new URL(enc_url_str).href;
      } catch(exception) {
        console.debug(exception);
      }

    entry.enclosure = {
      'url': enc_url,
      'enclosure_length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entry;
}

function find_entry_author(entry) {
  const author_element = find_child_by_name(entry, 'author');
  if(author_element) {
    const author_name = find_child_text(author_element, 'name');
    if(author_name)
      return author_name;
  }

  // In atom it is "dc:creator" but querySelector uses localName
  const creator = find_child_text(entry, 'creator');
  if(creator)
    return creator;
  return find_child_text(entry, 'publisher');
}

function find_entry_link(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  if(is_atom) {
    const link_element = find_child(entry, is_link_rel_alt) ||
      find_child(entry, is_link_rel_self) ||
      find_child(entry, is_link_with_href);
    if(link_element)
      return link_element.getAttribute('href');
  } else {
    return find_child_text(entry, 'origlink') ||
      find_child_text(entry, 'link');
  }
}

function find_entry_date(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  let date_str = null;

  if(is_atom)
    date_str = find_child_text(entry, 'published') ||
      find_child_text(entry, 'updated');
  else
    date_str = find_child_text(entry, 'pubdate') ||
      find_child_text(entry, 'date');
  if(date_str)
    date_str = date_str.trim();
  if(date_str)
    try {
      return new Date(date_str);
    } catch(exception) {
      console.debug(exception);
    }
  return null;
}

function find_entry_content(entry) {
  const is_atom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(is_atom) {
    const content = find_child_by_name(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, get_atom_node_text).join('').trim();
  } else {
    result = find_child_text(entry, 'encoded') ||
      find_child_text(entry, 'description') ||
      find_child_text(entry, 'summary');
  }
  return result;
}

function get_atom_node_text(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function find_child(parent_element, predicate) {
  for(let element = parent_element.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element))
      return element;
  }
  return null;
}

function find_child_by_name(parent_element, name) {
  if(typeof name !== 'string')
    throw new TypeError();
  return find_child(parent_element, function(element) {
    return element.localName === name;
  });
}

function find_child_text(element, name) {
  const child = find_child_by_name(element, name);
  if(child) {
    const childText = child.textContent;
    if(childText)
      return childText.trim();
  }
  return null;
}

this.parse_feed = parse_feed;

}
