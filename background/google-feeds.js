// Google Feeds API - ajax search service wrapper
(function(exports) {
'use strict';

var BASE_URL = 'https://ajax.googleapis.com/ajax/services/feed/find';
var GOOGLE_FEEDS_API_VERSION = '1.0';

// Artificial limit, set to 0 to allow any number of characters
var QUERY_MAX_CHARS = 1000;

// Generate the URL to send the request to
function buildRequestURL(query) {
  return BASE_URL + '?v='+ GOOGLE_FEEDS_API_VERSION + 
    '&q=' + encodeURIComponent(query);
}

/**
 * Submit a search request to the Google Feeds service. Async.
 * Passes two parameters to callback: query and results. Results
 * is an array of entry objects. The entry object has properties:
 * url, link, contentSnippet, title. url is the feed url. link
 * is the link from the feed. title is from the feed. contentSnippet
 * is a portion of the text from the feed's description.
 * both title and contentSnippet are pre-sanitized html. words from
 * the query are encloded in bold tags.
 *
 * TODO: use error codes instead of strings
 * TODO: strip break tag from snippets before passing to onSuccess
 * TODO: strip or replace '...' and ellipsis charcode from snippets
 *
 * @param query text query
 * @param onSuccess callback for results
 * @param onerror callback for errors
 * @param timeout optional timeout in ms for request
 */
function discoverFeeds(query, onSuccess, onError, timeout) {
  
  console.log('Sending feed search query %s', query);

  if(query) {
    query = query.trim();
  }
  
  if(!query) {
    onError('Empty query');
    return;
  }

  if(QUERY_MAX_CHARS && query.length > QUERY_MAX_CHARS) {
    onError('Query must be 1000 characters or less');
    return;
  }
  
  if(!window.navigator.onLine) {
    console.log('discoverFeeds - offline');
    onError('Not online');
    return;
  }

  var url = buildRequestURL(query);
  var request = new XMLHttpRequest();

  if(timeout) {
    request.timeout = timeout;
  }

  request.addEventListener('error', function(event) {
    console.log('discoverFeeds - error event');
    onError('Problem making request');
  });

  request.addEventListener('timeout', function(event) {
    console.log('discoverFeeds - timeout event');
    onError('The request timed out');
  });

  request.addEventListener('abort', function(event) {
    console.log('discoverFeeds - abort event');
    onError('The request was aborted');
  });

  request.addEventListener('load', function(event) {
    if(event.target.status != 200) {
      console.log('discoverFeeds - invalid status %s %s', event.target.status, event.target.statusText);
      onError('Invalid response code (' + event.target.status + ' ' + event.target.statusText + ')');
      return;
    }

    if(!event.target.response) {
      console.log('discoverFeeds - event.target.response is undefined');
      onError('Missing response');
      return;
    }

    var data = event.target.response.responseData;

    if(!data) {
      console.log('discoverFeeds - event.target.response.responseData is undefined');
      onError('Missing response data');
      return;
    }

    sanitizeEntries(data.entries);

    console.log('The search for "%s" found %s results', data.query, data.entries.length);

    onSuccess(data.query, data.entries);
  });

  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
}

function sanitizeEntries(entries) {
  var original = 0;
  for(var i = 0, ln = entries.length;i< ln;i++) {
    //entries[i].contentSnippet = 
    //  entries[i].contentSnippet.replace('<br>','').replace('<BR>','');
    entries[i].contentSnippet = entries[i].contentSnippet.replace(/<br>/gi,''); 
  }
}

// Exports
exports.discoverFeeds = discoverFeeds;

})(this);