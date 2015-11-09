// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Service that provides a method for finding feeds with a search query
// TODO: remove entries with identical urls from the results
class GoogleFeeds {

  static findFeed(query, timeout, callback) {
    const request = new XMLHttpRequest();
    request.timeout = timeout;
    request.onerror = callback;
    request.ontimeout = callback;
    request.onabort = callback;
    request.onload = GoogleFeeds._findFeedOnload.bind(request, callback);
    const url = GoogleFeeds.BASE_FIND_URL + encodeURIComponent(query);
    request.open('GET', url, true);
    request.responseType = 'json';
    request.send();
  }

  static _findFeedOnload(callback, event) {
    const data = event.target.response.responseData;
    const query = data.query || '';
    let entries = data.entries || [];
    entries = entries.filter(function(entry) {
      return entry.url;
    });

    // Remove duplicates. This works but it is pretty ugly
    // at the moment. Think of a cleaner way.
    const distinctEntriesMap = new Map();
    entries.forEach(function(entry) {
      distinctEntriesMap.set(entry.url, entry);
    });
    const distinctEntries = [];
    distinctEntriesMap.forEach(function(entryValue, urlKey) {
      distinctEntries.push(entryValue);
    });

    distinctEntries.forEach(GoogleFeeds._sanitizeEntry);
    callback(null, query, distinctEntries);
  }

  static _sanitizeEntry(entry) {

    const removeTags = StringUtils.removeTags;
    const truncate = StringUtils.truncate;
    const replaceBreaks = GoogleFeeds._replaceBreakRuleElements;

    if(entry.title) {
      entry.title = removeTags(entry.title);
      entry.title = truncate(entry.title, 100);
    }

    if(entry.contentSnippet) {
      entry.contentSnippet = replaceBreaks(entry.contentSnippet);
      entry.contentSnippet = truncate(entry.contentSnippet, 400);
    }
  }

  static _replaceBreakRuleElements(value) {
    return value.replace(/<\s*br\s*>/gi, '');
  }
}

GoogleFeeds.BASE_FIND_URL = 'https://ajax.googleapis.com/ajax/services/' +
  'feed/find?v=1.0&q=';
