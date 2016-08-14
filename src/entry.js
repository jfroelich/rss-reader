// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to an entry database object.
function Entry(otherEntry) {
  this.feed = null;
  this.urls = null;
  this.author = null;
  this.content = null;
  this.title = null;
  this.datePublished = null;
  this.enclosure = null;
  this.faviconURLString = null;
  this.feedTitle = null;
  this.readState = null;
  this.archiveState = null;
  this.dateCreated = null;
  this.dateArchived = null;

  if(otherEntry) {
    // TODO: this needs to fully deserialize urls and such
    Object.assign(this, otherEntry);
  }
}

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

// Returns the entry in archived form
Entry.prototype.archive = function() {
  const outputEntry = {};
  outputEntry.id = this.id;
  outputEntry.feed = this.feed;
  outputEntry.urls = [...this.urls];
  outputEntry.dateArchived = new Date();
  outputEntry.archiveState = Entry.FLAGS.ARCHIVED;
  // TODO: do i need to clone date to ensure purity?
  if(this.dateRead) {
    outputEntry.dateRead = this.dateRead;
  }
  return outputEntry;
};

// Returns a new Entry object where the fields have been sanitized
Entry.prototype.sanitize = function() {

  // Create a clone of this entry
  const entry = new Entry(this);

  // Sanitize the title
  // TODO: enforce a maximum length using StringUtils.truncateHTML
  // TODO: condense spaces?
  if(entry.title) {
    let title = entry.title;
    title = StringUtils.filterControlCharacters(title);
    title = StringUtils.replaceHTML(title, '');
    entry.title = title;
  }

  // Sanitize the author
  // TODO: sanitize fully
  if(entry.author) {
    let author = entry.author;
    author = StringUtils.filterControlCharacters(author);
    author = StringUtils.replaceHTML(author, '');
    //author = truncateHTML(author, MAX_AUTHOR_VALUE_LENGTH);
    entry.author = author;
  }

  // Sanitize entry.content
  // TODO: filter out non-printable characters other than \r\n\t
  // TODO: enforce a maximum storable length (using StringUtils.truncateHTML)

  return entry;
};

Entry.prototype.serialize = function() {

  // TODO: rather than use Object.assign and then delete keys, it would be
  // better to just selectively copy over defined fields.
  // First, this is more written code but less evaluated code
  // Second, this whitelists keys, instead of just checking a few

  // Clone to ensure purity
  // Clone into a simple object
  const entry = Object.assign({}, this);

  // Serialize URL objects
  // TODO: this should assume entries are always Entry objects
  // I need to check that all callers use Entry objects
  if(entry.urls && entry.urls.length &&
    Object.prototype.toString.call(entry.urls[0]) === '[object URL]') {
    entry.urls = entry.urls.map(function(url) {
      return url.href;
    });
  }

  // Delete keys that are undefined. Assign unfortunately copied over
  // everything.
  if(!entry.author) {
    delete entry.author;
  }

  if(!entry.title) {
    delete entry.title;
  }

  if(!entry.content) {
    delete entry.content;
  }

  if(!entry.enclosure) {
    delete entry.enclosure;
  }

  if(!entry.dateArchived) {
    delete entry.dateArchived;
  }

  return entry;
};
