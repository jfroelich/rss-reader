// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a new Entry instance where fields have been sanitized. This is a
// pure function. The input entry is not modified. Object properties of the
// input are cloned so that future changes to its properties have no effect on
// the sanitized copy.
// This function is not concerned with serialization.
function sanitize_entry(inputEntry) {

  const entry = new Entry();

  entry.archiveState = inputEntry.archiveState;

  // Sanitize the author html string
  // TODO: enforce a maximum length using truncate_html
  // TODO: condense spaces?
  if(inputEntry.author) {
    let author = inputEntry.author;
    author = filter_control_chars(author);
    author = replace_html(author, '');
    //author = truncateHTML(author, MAX_AUTHOR_VALUE_LENGTH);
    entry.author = author;
  }

  // Sanitize entry.content
  // TODO: filter out non-printable characters other than \r\n\t
  // TODO: enforce a maximum storable length (using truncate_html)
  // TODO: condense certain spaces? have to be careful about sensitive space
  entry.content = inputEntry.content;

  entry.id = inputEntry.id;
  entry.feed = inputEntry.feed;

  // Dates are mutable so we have to copy

  if(inputEntry.dateArchived) {
    entry.dateArchived = new Date(inputEntry.dateArchived.getTime());
  }

  if(inputEntry.dateCreated) {
    entry.dateCreated = new Date(inputEntry.dateCreated.getTime());
  }

  if(inputEntry.datePublished) {
    entry.datePublished = new Date(inputEntry.datePublished.getTime());
  }

  if(inputEntry.dateRead) {
    entry.dateRead = new Date(inputEntry.dateRead.getTime());
  }

  if(inputEntry.enclosure) {
    entry.enclosure = {
      'enclosure_length': inputEntry.enclosure.length,
      'type': inputEntry.enclosure.type,
      'url': null
    };

    if(inputEntry.enclosure.url) {
      entry.enclosure.url = new URL(inputEntry.enclosure.url.href);
    }
  }

  entry.faviconURLString = inputEntry.faviconURLString;
  entry.feedTitle = inputEntry.feedTitle;
  entry.readState = inputEntry.readState;

  // Sanitize the title
  // TODO: enforce a maximum length using truncate_html
  // TODO: condense spaces?
  if(inputEntry.title) {
    let title = inputEntry.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    entry.title = title;
  }

  if(inputEntry.urls) {
    entry.urls = [];
    for(let url of inputEntry.urls) {
      entry.urls.push(new URL(url.href));
    }
  }

  return entry;
}
