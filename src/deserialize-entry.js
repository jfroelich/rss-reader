// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Create a new Entry instance from the serialized input entry object
function deserialize_entry(serial) {

  const entry = new Entry();

  entry.archiveState = serial.archiveState;
  entry.author = serial.author;
  entry.content = serial.content;

  if(serial.dateArchived) {
    entry.dateArchived = new Date(serial.dateArchived.getTime());
  }

  if(serial.dateCreated) {
    entry.dateCreated = new Date(serial.dateCreated.getTime());
  }

  if(serial.datePublished) {
    entry.datePublished = new Date(serial.datePublished.getTime());
  }

  if(serial.dateRead) {
    entry.dateRead = new Date(serial.dateRead.getTime());
  }

  if(serial.enclosure) {
    entry.enclosure = {
      'enclosure_length': serial.enclosure.enclosure_length,
      'type': serial.enclosure.type,
      'url': null
    };

    if(serial.enclosure.url) {
      entry.enclosure.url = new URL(serial.enclosure.url);
    }
  }

  entry.faviconURLString = serial.faviconURLString;
  entry.feed = serial.feed;
  entry.feedTitle = serial.feedTitle;
  entry.id = serial.id;
  entry.readState = serial.readState;
  entry.title = serial.title;

  // Convert strings into URL objects
  if(serial.urls) {
    entry.urls = [];
    for(let url of serial.urls) {
      entry.urls.push(new URL(url));
    }
  }

  return entry;
}
