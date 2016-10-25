// See license.md

'use strict';

{

function update_badge(conn, log = SilentConsole) {
  log.log('Updating badge unread count');
  const ctx = {
    'conn': conn,
    'text': '?',
    'log': log
  };
  if(conn)
    db_count_unread_entries(ctx.log, conn).then(
      count_unread_on_success.bind(ctx)).catch(
        count_unread_on_error.bind(ctx));
  else
    db_connect(undefined, log).then(
      connect_on_success.bind(ctx)).catch(
        connect_on_error.bind(ctx));
}

function connect_on_success(conn) {
  this.log.debug('Connected to database %s to update badge', conn.name);
  db_count_unread_entries(this.log, conn).then(
    count_unread_on_success.bind(this)).catch(
      count_unread_on_error.bind(this));
  conn.close();
}

function count_unread_on_error(error) {
  this.text = 'ERR';
  on_complete.call(this);
}

function connect_on_error() {
  this.text = 'ERR';
  on_complete.call(this);
}

function count_unread_on_success(count) {
  if(count > 999) {
    this.text = '1k+';
  } else if(count < 0) {
    this.text = 'ERR';
  } else {
    this.text = '' + count;
  }
  on_complete.call(this);
}

function on_complete() {
  this.log.log('Setting badge text to', this.text);
  chrome.browserAction.setBadgeText({'text': this.text});
}

this.update_badge = update_badge;

}
