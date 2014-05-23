
var fetcher = {};

fetcher.fetch =  function(url, onSuccess, onError, timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.originalURL = url;
  request.errorCallback = onError || this.defaultErrorCallback_;
  request.onerror = this.onerror_;
  request.onabort = this.onabort_;
  request.ontimeout = this.ontimeout_;

  var allowedType = this.isAllowedMimeType;

  request.onload = function(event) {

    if(event.target.status != 200) {
      onError({type:'status',url:event.target.originalURL,status:event.target.status,
        statusText:event.target.statusText});
      return;
    }

    var type = (event.target.getResponseHeader('Content-Type') || '').toLowerCase();
    if(!allowedType(type)) {
      onError({type:'contentType',url:event.target.originalURL,contentType: type});
      return;
    }

    if(!event.target.responseXML) {
      onError({type:'undefinedResponseXML',url:event.target.originalURL});
      return;
    }

    if(!event.target.responseXML.documentElement) {
      onError({type:'undefinedDocumentElement',url:event.target.originalURL});
      return;
    }

    onSuccess(event.target.responseXML);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.setRequestHeader('Accept', fetcher.HEADER_ACCEPT_VALUE_);
  request.send();
};

// Simple noop (no operation)
fetcher.defaultErrorCallback_ = function() {

};

// Callback for request.onerror
fetcher.onerror_ = function(event) {
  event.target.errorCallback({
    type:'unknown',
    url:event.target.originalURL
  });
};

fetcher.onabort_ = function(event) {
  event.target.errorCallback({type:'abort',url:event.target.originalURL});
};

fetcher.ontimeout_ = function(event) {
  event.target.errorCallback({
    type:'timeout',
    url:event.target.originalURL,
    timeout:event.target.timeout
  });
};

// Array of allowed mime types (constant)
fetcher.ALLOWED_MIME_TYPES_ = [
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

// Precompiled header value string (constant)
fetcher.HEADER_ACCEPT_VALUE_ = fetcher.ALLOWED_MIME_TYPES_.join(', ');

// Returns true if the given type is one fo the allowed types
fetcher.isAllowedMimeType = function(type) {
  if(type) {
    for(var i = 0; i < fetcher.ALLOWED_MIME_TYPES_.length;i++) {
      if(strings.startsWith(type, fetcher.ALLOWED_MIME_TYPES_[i])) {
        return true;
      }
    }
  }
};