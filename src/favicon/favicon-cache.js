// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

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
  const db = event.target.result;
  if(!db.objectStoreNames.contains('favicon-cache')) {
    db.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

function findEntry(db, url, callback) {
  const pageURLString = normalizeURL(url).href;
  const tx = db.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = findEntryOnsuccess.bind(request, url, callback);
  request.onerror = findEntryOnerror.bind(request, url, callback);
}

function findEntryOnsuccess(url, callback, event) {
  const result = event.target.result;
  if(result) {
    console.debug('HIT', url.href, result.iconURLString);
    callback(result);
  } else {
    callback();
  }
}

function findEntryOnerror(url, callback, event) {
  console.error('Error searching for favicon cache entry', url.href, event);
  callback();
}

function addEntry(db, page_url, icon_url) {
  const entry = Object.create(null);
  const pageURLString = normalizeURL(page_url).href;
  entry.pageURLString = pageURLString;
  entry.iconURLString = icon_url.href;
  entry.dateUpdated = new Date();
  console.debug('Caching', entry);
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
}

function deleteEntry(db, page_url) {
  console.debug('Deleting', page_url.href);
  const pageURLString = normalizeURL(page_url).href;
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(pageURLString);
}

function openCursor(db, onsuccess, onerror) {
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onsuccess;
  request.onerror = onerror;
}

function normalizeURL(url) {
  const output_url = cloneURL(url);
  if(output_url.hash) {
    output_url.hash = '';
  }
  return output_url;
}

function cloneURL(url) {
  return new URL(url.href);
}

var rdr = rdr || {};
rdr.faviconCache = {};
rdr.faviconCache.connect = connect;
rdr.faviconCache.findEntry = findEntry;
rdr.faviconCache.addEntry = addEntry;
rdr.faviconCache.deleteEntry = deleteEntry;
rdr.faviconCache.openCursor = openCursor;

} // End file block scope
