// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: this will be used by both compact and lookup
// - move lookup stuff that belongs here to here, and update lookup to use
// this instead
// - change compact to use this instead
// - export multiple individual functions, not a class
// - update script includes in UI files

const DB_NAME = 'favicon-cache';
const DB_VERSION = 1;

function connect(onsuccess, onerror) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = upgrade;
  request.onsuccess = onsuccess;
  request.onerror = onerror;
  request.onblocked = onerror;
}

function upgrade(event) {
  console.log('Creating or upgrading database', DB_NAME, DB_VERSION);
  const connection = event.target.result;
  if(!connection.objectStoreNames.contains('favicon-cache')) {
    connection.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

function find_entry(db, url, callback) {
  const page_url_string = normalize_url(url).href;
  const tx = db.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(page_url_string);
  request.onsuccess = find_entry_onsuccess.bind(request, url, callback);
  request.onerror = find_entry_onerror.bind(request, url, callback);
}

function find_entry_onsuccess(url, callback, event) {
  const result = event.target.result;
  if(result) {
    console.debug('HIT', url.href, result.iconURLString);
    callback(result);
  } else {
    callback();
  }
}

function find_entry_onerror(url, callback, event) {
  console.error('Error searching for favicon cache entry', url.href, event);
  callback();
}

function add_entry(db, page_url, icon_url) {
  const page_url_string = normalize_url(page_url).href;
  const entry = Object.create(null);
  entry.pageURLString = page_url_string;
  entry.iconURLString = icon_url.href;
  entry.dateUpdated = new Date();
  console.debug('Caching', entry);
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
}

function delete_entry(db, page_url) {
  console.debug('Deleting', page_url.href);
  const page_url_string = normalize_url(page_url).href;
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(page_url_string);
}

function open_rw_cursor(db, onsuccess, onerror) {
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onsuccess;
  request.onerror = onerror;
}

function normalize_url(url) {
  const output_url = clone_url(url);
  if(output_url.hash) {
    output_url.hash = '';
  }
  return output_url;
}

function clone_url(url) {
  return new URL(url.href);
}

this.favicon_connect = connect;
this.favicon_find_entry = find_entry;
this.favicon_add_entry = add_entry;
this.favicon_delete_entry = delete_entry;
this.favicon_open_rw_cursor = open_rw_cursor;

} // End file block scope
