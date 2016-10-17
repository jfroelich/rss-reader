// See license.md

'use strict';

{

function updateBadge(conn, log) {
  log = log || SilentConsole;
  log.log('Updating badge unread count');

  const db = new FeedDb(log);
  const cache = new FeedCache(log);

  const ctx = {
    'conn': conn,
    'text': '?',
    'log': log,
    'cache': cache,
    'db': db
  };

  if(conn) {
    cache.countUnread(conn, onCountUnread.bind(ctx));
  } else {
    db.connect(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function openDBOnSuccess(conn) {
  this.log.log('Connected to database %s to update badge', this.db.name);
  this.cache.countUnread(conn, onCountUnread.bind(this));
  conn.close();
}

function openDBOnError() {
  this.text = 'ERR';
  onComplete.call(this);
}

function onCountUnread(count) {
  this.log.log('Counted %s unread entries', count);
  if(count > 999) {
    this.text = '1k+';
  } else if(count < 0) {
    this.text = 'ERR';
  } else {
    this.text = '' + count;
  }
  onComplete.call(this);
}

function onComplete() {
  this.log.log('Setting badge text to', this.text);
  chrome.browserAction.setBadgeText({'text': this.text});
}

this.updateBadge = updateBadge;

}
