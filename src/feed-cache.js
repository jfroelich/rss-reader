// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedCache {

  // TODO: entries must be sanitized fully
  static addEntry(connection, entry, callback) {

    const terminalEntryURL = Entry.prototype.getURL.call(entry);
    console.assert(terminalEntryURL, 'Entry missing url %O', entry);
    console.debug('Adding entry', terminalEntryURL.href);

    const storable = {};

    // Trusted property, no need to sanitize
    if(entry.faviconURLString) {
      storable.faviconURLString = entry.faviconURLString;
    }

    // Assume sanitized previously
    if(entry.feedTitle) {
      storable.feedTitle = entry.feedTitle;
    }

    // TODO: rename the property 'feed' to 'feedId'
    // feed id is trusted, no need to sanitize
    storable.feed = entry.feed;

    // Serialize and normalize the urls
    // There is no need to do additional sanitization
    // Expect urls to be objects not strings
    storable.urls = entry.urls.map(function(url) {
      return url.href;
    });

    storable.readState = Entry.FLAGS.UNREAD;
    storable.archiveState = Entry.FLAGS.UNARCHIVED;

    // TODO: sanitize fully
    if(entry.author) {
      let authorString = entry.author;
      authorString = StringUtils.filterControlCharacters(authorString);
      authorString = StringUtils.replaceHTML(authorString, '');
      //authorString = truncateHTML(authorString, MAX_AUTHOR_VALUE_LENGTH);
      storable.author = entry.author;
    }

    // TODO: enforce a maximum length using StringUtils.truncateHTML
    // TODO: condense spaces?
    if(entry.title) {
      let entryTitle = entry.title;
      entryTitle = StringUtils.filterControlCharacters(entryTitle);
      entryTitle = StringUtils.replaceHTML(entryTitle, '');
      storable.title = entryTitle;
    }

    storable.dateCreated = new Date();

    if(entry.datePublished) {
      storable.datePublished = entry.datePublished;
    }

    // TODO: filter out non-printable characters other than \r\n\t
    // TODO: enforce a maximum storable length (using StringUtils.truncateHTML)
    if(entry.content) {
      storable.content = entry.content;
    }

    const transaction = connection.transaction('entry', 'readwrite');
    const entryStore = transaction.objectStore('entry');
    const request = entryStore.add(storable);
    request.onsuccess = callback;
    request.onerror = callback;
  }
}
