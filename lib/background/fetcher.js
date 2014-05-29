var fetcher = {};

// TODO: refactor this to use a single argument that is an object 
// so that the calling code looks cleaner in how it calls this 
// method.

fetcher.fetch =  function(url, onSuccess, onError, timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.originalURL = url;
  request.errorCallback = onError || this.defaultErrorCallback_;
  request.onerror = this.onerror_;
  request.onabort = this.onabort_;
  request.ontimeout = this.ontimeout_;
  request.onload = function(event) {

    if(event.target.status != 200) {
      onError({type:'status',url:event.target.originalURL,status:event.target.status,
        statusText:event.target.statusText});
      return;
    }

    var contentType = (event.target.getResponseHeader('Content-Type') || '').toLowerCase();

    if(/(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType)) {
      if(!event.target.responseXML) {
        onError({type:'undefinedResponseXML',url:event.target.originalURL});
        return;
      }

      if(!event.target.responseXML.documentElement) {
        onError({type:'undefinedDocumentElement',url:event.target.originalURL});
        return;
      }

      onSuccess(event.target.responseXML, contentType);
      return;
    }

    // Fallback attempt at handling incorrect mime type
    if(/text\/(plain|html)/i.test(contentType)) {
      try {
        // TODO: pass along charset to parseFromString
        var xmlDocument = xml.parseFromString(event.target.responseText);
        onSuccess(xmlDocument, contentType);
      } catch(parseException) {
        onError({type:'parseException',url:event.target.originalURL,
          contentType: contentType,exception:parseException});
      }

      return;
    }

    // Unknown content type
    onError({type:'contentType',url:event.target.originalURL,contentType: contentType});
  };

  request.open('GET', url, true);
  request.send();
};


fetcher.defaultErrorCallback_ = function() {};

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