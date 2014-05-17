// Lib for fetching feeds
(function(exports) {
'use strict';

var ALLOWED_MIME_TYPES = [
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

var HEADER_ACCEPT_VALUE = ALLOWED_MIME_TYPES.join(', ');


// noop
function defaultErrorCallback() {}

function fetchErrorHandler(event) {
  event.target.errorCallback({'type':'unknown','url':event.target.originalURL});
}

function fetchAbortHandler(event) {
  event.target.errorCallback({'type':'abort','url':event.target.originalURL});
}

function fetchTimeoutHandler(event) {
  event.target.errorCallback({
    'type':'timeout',
    'url':event.target.originalURL,
    'timeout':event.target.timeout});
}

function fetch(url, onSuccess, onError, timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.originalURL = url;
  request.errorCallback = onError || defaultErrorCallback;
  request.addEventListener('error', fetchErrorHandler);
  request.addEventListener('abort', fetchAbortHandler);
  request.addEventListener('timeout', fetchTimeoutHandler);
  request.addEventListener('load', function(event) {

    if(event.target.status != 200) {
      onError({'type':'status','url':event.target.originalURL,'status':event.target.status,
        'statusText':event.target.statusText});
      return;
    }

    var type = (event.target.getResponseHeader('Content-Type') || '').toLowerCase();
    if(!isAllowedMimeType(type)) {
      onError({'type':'contentType','url':event.target.originalURL,'contentType': type});
      return;
    }

    if(!event.target.responseXML) {
      onError({'type':'undefinedResponseXML','url':event.target.originalURL});
      return;
    }

    if(!event.target.responseXML.documentElement) {
      onError({'type':'undefinedDocumentElement','url':event.target.originalURL});
      return;
    }

    onSuccess(event.target.responseXML);
  });

  request.open('GET', url, true);
  request.responseType = 'document';
  request.setRequestHeader('Accept', HEADER_ACCEPT_VALUE);
  request.send();
}

function isAllowedMimeType(type) {
  if(type) {
    for(var i = 0; i < ALLOWED_MIME_TYPES.length;i++) {
      if(type.lastIndexOf(ALLOWED_MIME_TYPES[i], 0) === 0) {
        return true;
      }
    }
  }
}

exports.fetchFeed = fetch;

})(this);