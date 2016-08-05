// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to an entry database object.

function Entry() {}

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

Entry.prototype.sanitize = function() {
  // Assume entry.feedTitle was sanitized elsewhere
  const outputEntry = Object.assign({}, this);

  // Sanitize the title
  // TODO: enforce a maximum length using StringUtils.truncateHTML
  // TODO: condense spaces?
  if(outputEntry.title) {
    let title = outputEntry.title;
    title = StringUtils.filterControlCharacters(title);
    title = StringUtils.replaceHTML(title, '');
    outputEntry.title = title;
  }

  // Sanitize the author
  // TODO: sanitize fully
  if(outputEntry.author) {
    let author = outputEntry.author;
    author = StringUtils.filterControlCharacters(author);
    author = StringUtils.replaceHTML(author, '');
    //author = truncateHTML(author, MAX_AUTHOR_VALUE_LENGTH);
    outputEntry.author = author;
  }

  // Sanitize outputEntry.content
  // TODO: filter out non-printable characters other than \r\n\t
  // TODO: enforce a maximum storable length (using StringUtils.truncateHTML)

  return outputEntry;
};

Entry.prototype.serialize = function() {
  // Clone to ensure purity
  const outputEntry = Object.assign({}, this);

  // Serialize URL objects
  if(outputEntry.urls && outputEntry.urls.length) {
    if(Object.prototype.toString.call(outputEntry.urls[0]) === '[object URL]') {
      outputEntry.urls = outputEntry.urls.map(function urlToString(url) {
        return url.href;
      });
    }
  }

  // TODO: delete all keys other than those that I want stored in the event
  // that there are expando props present in the input object?

  return outputEntry;
};
