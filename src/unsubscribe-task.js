// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const UnsubscribeTask = {};

UnsubscribeTask.start = function(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id %s', feedId);
  console.debug('Unsubscribing from feed with id', feedId);

  const context = {
    'feedId': feedId,
    'entriesRemoved': 0,
    'callback': callback,
    'cache': new FeedCache()
  };

  context.cache.open(UnsubscribeTask.onOpenDatabase.bind(null, context));
};

UnsubscribeTask.onOpenDatabase = function(context, connection) {
  if(connection) {
    context.connection = connection;
    context.cache.openEntryCursorForFeed(connection, context.feedId,
      UnsubscribeTask.deleteNextEntry.bind(null, context));
  } else {
    UnsubscribeTask.onComplete(context, 'ConnectionError');
  }
};

UnsubscribeTask.deleteNextEntry = function(context, event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    cursor.delete();
    context.entriesRemoved++;
    UnsubscribeTask.sendEntryDeleteRequestedMessage(entry);
    cursor.continue();
  } else {
    UnsubscribeTask.onRemoveEntries(context);
  }
};

UnsubscribeTask.sendEntryDeleteRequestedMessage = function(entry) {
  chrome.runtime.sendMessage({
    'type': 'entryDeleteRequestedByUnsubscribe',
    'entryId': entry.id
  });
};

UnsubscribeTask.onRemoveEntries = function(context) {
  context.cache.deleteFeedById(context.connection, context.feedId,
    UnsubscribeTask.onDeleteFeed.bind(null, context));
};

UnsubscribeTask.onDeleteFeed = function(context, event) {
  UnsubscribeTask.onComplete(context, 'success');
};

UnsubscribeTask.onComplete = function(context, type) {
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
};
