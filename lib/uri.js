// Very basic URI lib

// TODO: refactor to be based on https://github.com/derek-watson/jsUri
// TODO: look into using https://developer.mozilla.org/en-US/docs/Web/API/URL

var URI = {};

URI.parser_ = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/

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