// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Creates a basic object suitable for storage in indexedDB. This does not do
// any sanitization of values. This only sets fields if defined.
function serialize_entry(entry) {
  const serial = {};

  if(typeof entry.archiveState === 'number') {
    serial.archiveState = entry.archiveState;
  }

  if(entry.author) {
    serial.author = entry.author;
  }

  if(entry.content) {
    serial.content = entry.content;
  }

  // Date objects are cloned to ensure purity
  if(entry.dateArchived) {
    serial.dateArchived = new Date(entry.dateArchived.getTime());
  }

  if(entry.dateCreated) {
    serial.dateCreated = new Date(entry.dateCreated.getTime());
  }

  if(entry.datePublished) {
    serial.datePublished = new Date(entry.datePublished.getTime());
  }

  if(entry.dateRead) {
    serial.dateRead = new Date(entry.dateRead.getTime());
  }

  if(entry.enclosure) {
    serial.enclosure = {};
    if(entry.enclosure.enclosure_length) {
      serial.enclosure.enclosure_length = entry.enclosure.enclosure_length;
    }
    if(entry.enclosure.type) {
      serial.enclosure.type = entry.enclosure.type;
    }
    if(entry.enclosure.url) {
      serial.enclosure.url = entry.enclosure.url.toString();
    }
  }

  if(entry.faviconURLString) {
    serial.faviconURLString = entry.faviconURLString;
  }

  if(entry.feedTitle) {
    serial.feedTitle = entry.feedTitle;
  }

  if(typeof entry.feed === 'number') {
    serial.feed = entry.feed;
  }

  if(typeof entry.id === 'number') {
    serial.id = entry.id;
  }

  if(typeof entry.readState === 'number') {
    serial.readState = entry.readState;
  }

  if(entry.title) {
    serial.title = entry.title;
  }

  if(entry.urls && entry.urls.length) {
    serial.urls = [];
    for(let url of entry.urls) {
      serial.urls.push(url.toString());
    }
  }

  return serial;
}
