// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function searchGoogleFeeds(query, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = function(event) {
    const data = event.target.response.responseData;
    let responseQuery = data.query || '';
    let entries = data.entries || [];
    entries = entries.filter(function(entry) {
      return entry.url;
    });
    entries.forEach(function(entry) {
      if(entry.title) {
        entry.title = StringUtils.removeTags(entry.title);
        entry.title = StringUtils.truncate(entry.title, 100);
      }
      if(entry.contentSnippet) {
        entry.contentSnippet = entry.contentSnippet.replace(/<br>/gi, '');
        entry.contentSnippet = StringUtils.truncate(
          entry.contentSnippet, 400);
      }
    });
    callback(null, responseQuery, entries);
  };
  const url = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=' + 
    encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
}
