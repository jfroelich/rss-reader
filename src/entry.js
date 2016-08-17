// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to an entry database object.
// @param entry {Object} optional serialized entry, if present will deserialize
// its fields into this instance
function Entry(entry) {
  this.archiveState = Entry.FLAGS.UNARCHIVED;
  this.author = null;
  this.content = null;
  this.dateArchived = null;
  this.dateCreated = null;
  this.datePublished = null;
  this.dateRead = null;
  this.enclosure = null;
  this.faviconURLString = null;
  this.feedTitle = null;
  this.feed = null;
  this.id = null;
  this.readState = Entry.FLAGS.UNREAD;
  this.title = null;
  this.urls = null;

  if(entry) {
    this.deserialize(entry);
  }
}

// Copy over everything. This copies values into this instance, it
// does not return a new instance.
// I started getting strange errors with Object.assign
// so now this does manual copying.
Entry.prototype.deserialize = function(entry) {
  this.archiveState = entry.archiveState;
  this.author = entry.author;
  this.content = entry.content;

  if(entry.dateArchived) {
    this.dateArchived = new Date(entry.dateArchived.getTime());
  }

  if(entry.dateCreated) {
    this.dateCreated = new Date(entry.dateCreated.getTime());
  }

  if(entry.datePublished) {
    this.datePublished = new Date(entry.datePublished.getTime());
  }

  if(entry.dateRead) {
    this.dateRead = new Date(entry.dateRead.getTime());
  }

  if(entry.enclosure) {
    this.enclosure = {
      'enclosure_length': entry.enclosure.enclosure_length,
      'type': entry.enclosure.type,
      'url': null
    };

    if(entry.enclosure.url) {
      this.enclosure.url = new URL(entry.enclosure.url);
    }
  }

  this.faviconURLString = entry.faviconURLString;
  this.feed = entry.feed;
  this.feedTitle = entry.feedTitle;
  this.id = entry.id;
  this.readState = entry.readState;
  this.title = entry.title;

  // Convert strings into URL objects
  if(entry.urls) {
    this.urls = [];
    for(let url of entry.urls) {
      this.urls.push(new URL(url));
    }
  }
};

Entry.FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

Entry.prototype.addURL = function(url) {

  if(!this.urls) {
    this.urls = [];
  }

  if(Object.prototype.toString.call(url) === '[object URL]') {
    // TODO: could be called with URL object but urls are strings
    if(this.urls.length) {
      //console.debug('Searching for url object in array of url objects');
      if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {

        // cannot use includes because URL object equality is funky
        for(let urlObject of this.urls) {
          if(urlObject.href === url.href) {
            return;
          }
        }
      } else {
        //console.debug('Searching for url object in array of url strings');
        for(let urlString of this.urls) {
          if(urlString === url.href) {
            return;
          }
        }
      }
    }

    //console.debug('Appending unique url object', url.href);
    this.urls.push(url);
  } else {

    if(this.urls.length) {
      if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {
        //console.debug('Searching for url string in array of url objects');

        for(let urlObject of this.urls) {
          if(urlObject.href === url) {
            return;
          }
        }

      } else {
        //console.debug('Searching for url string in array of url strings');
        if(this.urls.includes(url)) {
          return;
        }
      }

      //console.debug('Appending unique url string', url);
      this.urls.push(url);
    }
  }
};

Entry.prototype.getURL = function() {
  if(Entry.prototype.hasURL.call(this)) {
    return this.urls[this.urls.length - 1];
  }
};

Entry.prototype.hasURL = function() {
  return this.urls && this.urls.length;
};

// Returns a new Entry instance representing the archived form of this entry
Entry.prototype.archive = function() {

  const entry = new Entry();
  entry.archiveState = Entry.FLAGS.ARCHIVED;
  entry.dateArchived = new Date();

  if(this.dateRead) {
    entry.dateRead = new Date(this.dateRead.getTime());
  }

  entry.feed = this.feed;
  entry.id = this.id;
  entry.readState = this.readState;
  if(this.urls) {
    entry.urls = [];
    for(let url of this.urls) {
      entry.urls.push(new URL(url.href));
    }
  }

  return entry;
};

// Returns a new Entry object where the fields have been sanitized
Entry.prototype.sanitize = function() {

  const entry = new Entry();
  entry.archiveState = this.archiveState;

  // Sanitize the author
  // TODO: sanitize fully
  if(this.author) {
    let author = this.author;
    author = filter_control_chars(author);
    author = replace_html(author, '');
    //author = truncateHTML(author, MAX_AUTHOR_VALUE_LENGTH);
    entry.author = author;
  }

  // Sanitize entry.content
  // TODO: filter out non-printable characters other than \r\n\t
  // TODO: enforce a maximum storable length (using truncate_html)
  entry.content = this.content;

  entry.id = this.id;
  entry.feed = this.feed;

  if(this.dateArchived) {
    entry.dateArchived = new Date(this.dateArchived.getTime());
  }

  if(this.dateCreated) {
    entry.dateCreated = new Date(this.dateCreated.getTime());
  }

  if(this.datePublished) {
    entry.datePublished = new Date(this.datePublished.getTime());
  }

  if(this.dateRead) {
    entry.dateRead = new Date(this.dateRead.getTime());
  }

  if(this.enclosure) {
    entry.enclosure = {
      'enclosure_length': this.enclosure.length,
      'type': this.enclosure.type,
      'url': null
    };

    if(this.enclosure.url) {
      entry.enclosure.url = new URL(this.enclosure.url.href);
    }
  }

  entry.faviconURLString = this.faviconURLString;
  entry.feedTitle = this.feedTitle;
  entry.readState = this.readState;

  // Sanitize the title
  // TODO: enforce a maximum length using truncate_html
  // TODO: condense spaces?
  if(this.title) {
    let title = this.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    entry.title = title;
  }

  if(this.urls) {
    entry.urls = [];
    for(let url of this.urls) {
      entry.urls.push(new URL(url.href));
    }
  }

  return entry;
};

// Creates a basic object suitable for storage in indexedDB. This does not do
// any sanitization of values. This only sets fields if defined.
Entry.prototype.serialize = function() {
  // Create a basic object representing the serialized entry that we will
  // output
  const object = {};

  if(typeof this.archiveState === 'number') {
    object.archiveState = this.archiveState;
  }

  if(this.author) {
    object.author = this.author;
  }

  if(this.content) {
    object.content = this.content;
  }

  // Date objects are cloned to ensure purity
  if(this.dateArchived) {
    object.dateArchived = new Date(this.dateArchived.getTime());
  }

  if(this.dateCreated) {
    object.dateCreated = new Date(this.dateCreated.getTime());
  }

  if(this.datePublished) {
    object.datePublished = new Date(this.datePublished.getTime());
  }

  if(this.dateRead) {
    object.dateRead = new Date(this.dateRead.getTime());
  }

  if(this.enclosure) {
    object.enclosure = {};
    if(this.enclosure.enclosure_length) {
      object.enclosure.enclosure_length = this.enclosure.enclosure_length;
    }
    if(this.enclosure.type) {
      object.enclosure.type = this.enclosure.type;
    }
    if(this.enclosure.url) {
      object.enclosure.url = this.enclosure.url.toString();
    }
  }

  if(this.faviconURLString) {
    object.faviconURLString = this.faviconURLString;
  }

  if(this.feedTitle) {
    object.feedTitle = this.feedTitle;
  }

  if(typeof this.feed === 'number') {
    object.feed = this.feed;
  }

  if(typeof this.id === 'number') {
    object.id = this.id;
  }

  if(typeof this.readState === 'number') {
    object.readState = this.readState;
  }

  if(this.title) {
    object.title = this.title;
  }

  if(this.urls && this.urls.length) {
    object.urls = [];
    for(let url of this.urls) {
      object.urls.push(url.toString());
    }
  }

  return object;
};
