// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Generates an OPML XML file and triggers its download
// TODO: callback with error message so click handler can show an error
// or something like this? E.g. use a callback
// TODO: use db.getFeedsArray instead of openFeedsCursor?
// TODO: allow for a host document somehow, instead of hardcoding reference
// to document.body?
// TODO: could i actually just append the anchor to documentElement instead
// of body?
function exportOPML() {
  const feeds = [];

  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug('Failed to connect to database when exporting opml');
      return;
    }

    const connection = event.target.result;
    db.openFeedsCursor(connection, handleCursor);
  };

  function handleCursor(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      onGetAllFeeds();
    }
  }

  function onGetAllFeeds() {
    const title = 'Subscriptions';
    const doc = createOPMLDocument(title);

    for(let i = 0, len = feeds.length; i < len; i++) {
      appendFeedToOPMLDocument(doc, feeds[i]);
    }

    const writer = new XMLSerializer();
    const serializedString = writer.serializeToString(doc);

    const blobFormat = {'type': 'application/xml'};
    const blob = new Blob([serializedString], blobFormat);
    const objectURL = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectURL;
    const fileName = 'subscriptions.xml';
    anchor.setAttribute('download', fileName);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup
    URL.revokeObjectURL(objectURL);
    anchor.remove();

    console.debug('Completed exporting %s feeds to opml file %s',
      feeds.length, fileName);

    // TODO: show a message? An alert? Something?
  };
}
