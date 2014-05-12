// Very basic URI lib
(function(g) {
'use strict';

var URI = {};


// Parse a string into a URI
URI.parse = function(str) {
  if(str) {
    var m = str.match(/^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/);
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
    if(obj.scheme) s = obj.scheme + ':';
    if(obj.host) s += '//' + obj.host ;
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
    return URI.toString(path);
  }
};

// Very basic URL validition
URI.isValid = function(obj) {
  // A defined object, with a host property, that contains a period, 
  // that does not start with a period.
  
  // If there is no scheme, URI.parse shoves host into path, 
  // which is a bug. Treat path as the host
  if(obj) {
    var host = obj.scheme ? obj.host : obj.path;
    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;    
  }
};

g.URI = URI;

}(this));