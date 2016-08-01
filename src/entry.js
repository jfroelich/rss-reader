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

Entry.prototype.getURL = function() {
  if(this.urls && this.urls.length) {
    return this.urls[this.urls.length - 1];
  }
  return null;
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
