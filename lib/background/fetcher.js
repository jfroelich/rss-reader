// onSuccess now getting two arguments, the xml and then the contentType (which has full value
// at the moment, which may include trailing ';charset')

// TODO: look into response.originalURL vs responseXML.URL/documentURI
// as a method for detecting redirects

var fetcher = {};

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

    // Note that this contains the full type which includes optional ';character set'
    // TODO: parse out and mime type (e.g. str.split.(';')[0]) and charset
    // e.g. str.split(';')[1]. Also note charset may not be present or may not be wellformed.
    var contentType = (event.target.getResponseHeader('Content-Type') || '').toLowerCase();

    if(fetcher.isMimeTypeXML(contentType)) {
      // console.log('Fetched xml. The mime type is %s. Processing as XML.', contentType);
      
      // These checks make sense if we are dealing with XML
      if(!event.target.responseXML) {
        onError({type:'undefinedResponseXML',url:event.target.originalURL});
        return;
      }

      if(!event.target.responseXML.documentElement) {
        onError({type:'undefinedDocumentElement',url:event.target.originalURL});
        return;
      }
      
      // Pass along the xml document to the callback and exit from onload.
      onSuccess(event.target.responseXML, contentType);
      return;
    }

    // If we reached here we are not dealing with an XML mime type.
    // Try fallback handling for text/html.
    if(strings.startsWith(contentType, 'text/html')) {
      var xmlDocument = null;
      
      try {
        xmlDocument = xml.parseFromString(event.target.responseText);
        onSuccess(xmlDocument, contentType);
        return;
      } catch(ioexception) {
        console.log(ioexception);
        onError({type:'ioexception',
          url:event.target.originalURL,
          contentType: contentType,exception:ioexception});
        return;
      }
    }

    // If we reached here we are not dealing with a handleable mime type, or mime
    // type header is undefined. Just error out.
    onError({type:'contentType',url:event.target.originalURL,contentType: contentType});
  };

  request.open('GET', url, true);
  
  // If this is set then tries to parse XML. But that fails
  // if the returned time is xml as html.
  // THIS DOES NOT WORK. responseText in console reports [Exception: DOMException]
  // We cannot access responseText because we set responseType to 'document'.
  // In this case, responseXML contains 'some' html, but not the original 
  // document which is now completely inaccessible.
  // If we instead do not set it, the behavior appears to be to populate all of the 
  // fields, and responseXML is still available for normal processing. responseXML 
  // is available for xml mime types as well as text/html, but there is no express 
  // notification of a problem with parsing the html as xml but for the fact that 
  // responseXML does not always contain the actual data. So the above must be 
  // written to work based on mime type.
  //request.responseType = 'document';

  // Setting Accept does not seem to be affecting anything
  //request.setRequestHeader('Accept', fetcher.HEADER_ACCEPT_VALUE_);
  
  request.send();
};

// Searches for the presence of a root node of a feed 
// embedded in an HTMLDocument object and returns it as 
// the root node of an XMLDocument with a proper documentElement
fetcher.coerceHTML = function(response) {
  try {
    return xml.parseFromString(response.responseText);
  } catch(exception) {
    // TODO: remove this
    console.dir(exception);
  }

  return null;
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
fetcher.XML_MIME_TYPES_ = [
  'application/atom+xml','application/rdf+xml','application/rss+xml','application/xml','text/xml'
];

// Precompiled header value string (constant)
fetcher.HEADER_ACCEPT_VALUE_ = fetcher.XML_MIME_TYPES_.join(', ');

// Returns true if the given type is one fo the allowed types
fetcher.isMimeTypeXML = function(type) {
  if(type) {
    for(var i = 0; i < fetcher.XML_MIME_TYPES_.length;i++) {
      if(strings.startsWith(type, fetcher.XML_MIME_TYPES_[i])) {
        return true;
      }
    }
  }
};