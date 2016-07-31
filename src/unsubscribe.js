// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function unsubscribe(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id %s', feedId);
  console.debug('Unsubscribing from feed with id', feedId);

  const context = {
    'feedId': feedId,
    'entriesRemoved': 0,
    'callback': callback,
    'cache': new FeedCache()
  };

  context.cache.open(unsubscribeOnOpenDatabase.bind(null, context));
}

function unsubscribeOnOpenDatabase(context, connection) {
  if(connection) {
    context.connection = connection;
    context.cache.openEntryCursorForFeed(connection, context.feedId,
      unsubscribeDeleteNextEntry.bind(null, context));
  } else {
    unsubscribeOnComplete(context, 'ConnectionError');
  }
}

function unsubscribeDeleteNextEntry(context, event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    cursor.delete();
    context.entriesRemoved++;
    chrome.runtime.sendMessage({
      'type': 'entryDeleteRequested',
      'entryId': entry.id
    });
    cursor.continue();
  } else {
    unsubscribeOnRemoveEntries(context);
  }
}

function unsubscribeOnRemoveEntries(context) {
  context.cache.deleteFeedById(context.connection, context.feedId,
    unsubscribeOnDeleteFeed.bind(null, context));
}

function unsubscribeOnDeleteFeed(context, event) {
  unsubscribeOnComplete(context, 'success');
}

function unsubscribeOnComplete = function(context, type) {
  if(context.entriesRemoved > 0) {
    const badgeUpdateService = new BadgeUpdateService();
    badgeUpdateService.updateCount();
  }

  if(context.connection) {
    context.connection.close();
  }

  if(context.callback) {
    context.callback({
      'type': type,
      'feedId': context.feedId,
      'entriesRemoved': context.entriesRemoved
    });
  }
}
