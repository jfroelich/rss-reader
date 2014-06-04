// Very basic URI lib

var URI = {};

URI.parser_ = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;

// Parse a string into a URI
URI.parse = function(str) {
  if(str) {
    var m = str.match(this.parser_);
    var r = {};
    if(m[1]) r.scheme = m[1];
    if(m[2]) r.host = m[2];
    if(m[3]) r.path = m[3];
    if(m[4]) r.query = m[4];
    if(m[5]) r.fragment = m[5];
    return r;
  }
};

// Convert URI to string representation
URI.toString = function(obj) {
  if(obj) {
    var s = '';
    if(obj.scheme) s = obj.scheme + '://';
    if(obj.host) s += obj.host;
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
};

// Convert a relative URI to an absolute URI string
// TODO: return a URI object, let the caller decide what to do with it
URI.resolve = function(base,path) {
  if(base && path) {
    if(!path.scheme) path.scheme = base.scheme;
    if(!path.host) path.host = base.host;
    return this.toString(path);
  }
};

// Extremely basic URL validition
URI.isValid = function(obj) {

  if(obj) {

    // If there is no scheme, URI.parse shoves host into path, 
    // which is sort of a bug. Treat path as the host
    var host = obj.scheme ? obj.host : obj.path;

    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;    
  }
};

URI.isValidString = function(str) {
  return URI.isValid(URI.parse(str));
};


// Adapted from https://github.com/derek-watson/jsUri

var URI2 = {};

URI2.parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

URI2.keys = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 
  'port', 'relative', 'path', 'directory', 'file', 'query', 'fragment'];

URI2.parse = function(str) {
  
  // Note: using window.URL does not work because it throws 
  // syntax errors when protocol/host are absent.
  
  var parser = document.createElement('a');
  parser.href = str;
  var parts = {};
  if(parser.protocol) {
    if(parser.protocol != 'chrome-extension:') {
      parts.protocol = parser.protocol.substring(0, parser.protocol.length -1);
    }
  }

  if(parser.hostname) {
    if(parser.hostname != chrome.runtime.id) {
      parts.host = parser.hostname;
    }
  }
  
  if(parser.port) {
    parts.port = parser.port;
  }
  
  // NOTE: this automatically inserts leading /
  if(parser.pathname) {
    parts.path = parser.pathname;
  }
  
  if(parser.search && parser.search.length > 1) {
    parts.query = parser.search.substring(1);
  }
  
  if(parser.hash && parser.hash.length > 1) {
    parts.fragment = parser.hash.substring(1);
  }
  
  parser = null;
  return parts;
};

URI2.toString = function(obj) {
  if(obj) {
    var s = '';
    if(obj.protocol) s += obj.protocol + '://';
    if(obj.host) s += obj.host;
    if(obj.port) s += ':'+obj.port;
    
    // NOTE: because path gets a leading slash 
    // automatically when parsing, this will include 
    // a leading slash here automatically, so 
    // URI.toString(URI.parse(url)) is not necessarily equal to url.
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
};

URI2.resolve = function(baseURI, relativeURI) {
  if(!baseURI) return relativeURI;

  if(relativeURI) {
    
    if(!relativeURI.protocol) {
      relativeURI.protocol = baseURI.protocol;
    }
    
    if(!relativeURI.host) {
      relativeURI.host = baseURI.host;
    }
    
    // TODO: return the URI object and let caller 
    // decide what to do (whether to call toString)
    //return relativeURI;
    return this.toString(relativeURI);
  }
};