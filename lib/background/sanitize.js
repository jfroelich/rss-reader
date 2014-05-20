// Sanitize entry content
(function(exports){
'use strict';

// Walking and sanity behaviors
var RETAIN = 0, UNWRAP = 1, REMOVE = 2, RETAIN_RAW = 3, REPLACE = 4;

// Replace a node with its children.
function unwrap(node) {
  while(node.firstChild)
    node.parentNode.insertBefore(node.firstChild, node);
  node.parentNode.removeChild(node);
}

// DOM walk that supports unwrap/remove
function walk(root, cb) {
  var node = root.firstChild, prev = node, walking = !!node, result;
  while(walking) {
    result = cb(prev = node);
    if(result !== REMOVE && node.firstChild) {
      node = node.firstChild;
    } else {
      while(walking && !node.nextSibling) {
        walking = node != root;
        node = node.parentNode;
      }
      node = node.nextSibling;
    }

    if(result == UNWRAP) {
      unwrap(prev);
    } else if(result == REMOVE) {
      prev.parentNode.removeChild(prev);
    }
  }
}

// Returns a sanitized HTMLDocument object with the body element as the root'
// TODO: do I even need to return the object or is it modified in place?
// TODO: do I even need to pass in strBaseURL?
function sanitize(strBaseURL, doc) {
  if(!strBaseURL) {
    console.warn('Base URL is undefined? Unclear behavior');
  }

  // TODO: do i need the || '' ?
  var baseURI = URI.parse(strBaseURL || '');

  walk(doc.body, function(node) {    
    if(node.nodeType == Node.COMMENT_NODE) {
      return REMOVE;
    } else if(node.nodeType == Node.ELEMENT_NODE) {
      var handler = getHandler(node);
      if(handler) {
        var result = handler(node, baseURI);

        if(result == RETAIN || result == REPLACE) {
          each(Array.prototype.filter.call(node.attributes, isUnknwownAttribute),
            function(att) {
              node.removeAttribute(att.nodeName);
            }
          );
        }

        return result;

      } else {
        console.log('No handler for node %s',node.outerHTML);
        return REMOVE;
      }
    }

    return RETAIN;
  });

  return doc;
}

function getHandler(element) {
  // TODO: does tagName avoid semi-colon check
  
  // localName is lowercase
  var elementName = element.localName;
  var colon = elementName.indexOf(':');
  if(colon != -1) {
    elementName = elementName.substring(colon + 1);
  }

  return handlers[elementName];
}


// Attributes allowed in any element
var ALLOWED_ATTRIBUTES = {
  'alt':true,
  'href':true,
  'src':true,
  'target':true,
  'title':true,
  'valign':true
};
// Returns true if the given attribute is not a known attribute
function isUnknwownAttribute(attribute) {
  return !ALLOWED_ATTRIBUTES.hasOwnProperty(attribute.nodeName);
}


//////////////////////////////////////////////////////////////////////////////////////////
// Element handler definitions

var keep = function() { return RETAIN; };
var keepRaw = function() { return RETAIN_RAW; };
var removeHandler = function() { return REMOVE; };
var unwrapHandler = function() { return UNWRAP; };

var handlers = {
  abbr : keep,
  acronym : keep,
  address : keep,
  applet : keepRaw,
  area : keep,
  article : unwrapHandler,
  aside : keep,
  audio : keepRaw,
  b : keep,
  base : removeHandler,
  basefont : removeHandler,
  bdi : keep,
  bdo : keep,
  big : keep,
  br : keep,
  blockquote : keep,
  canvas : keep,
  caption : keep,
  center : unwrapHandler,
  cite : keep,
  code : keep,
  col : keep,
  colgroup : keep,
  command : removeHandler,
  data : keep,
  datalist : removeHandler,
  details : unwrapHandler,
  dialog : removeHandler,
  dir : keep,
  dd : keep,
  del : keep,
  dfn : keep,
  div : unwrapHandler,
  dl : keep,
  dt : keep,
  em : keep,
  entry : keep,
  fieldset : removeHandler,
  figcaption : keep,
  figure : keep,
  font : unwrapHandler,
  footer : keep,
  frame : removeHandler,
  frameset : removeHandler,
  header : keep,
  help : unwrapHandler,
  hgroup : keep,
  hr : keep,
  h1 : keep,
  h2 : keep,
  h3 : keep,
  h4 : keep,
  h5 : keep,
  h6 : keep,
  html : removeHandler,
  i : keep,
  input : removeHandler,
  ins : keep,
  insert : unwrapHandler,
  inset : keep,
  label : unwrapHandler,
  legend : removeHandler,
  li : keep,
  link : removeHandler,
  kbd : keep,
  main : keep,
  mark : keep,
  map : keep,
  'math' : removeHandler,
  meta : removeHandler,
  meter : keep,
  nav : keep,
  nobr : unwrapHandler,
  noframes : removeHandler,
  noscript : unwrapHandler,
  ol : keep,
  param : keepRaw,
  option : removeHandler,
  optgroup : removeHandler,
  output : removeHandler,
  p : keep,
  pre : keep,
  progress : keep,
  q : keep,
  rp : keep,
  rt : keep,
  ruby : keep,
  s : keep,
  samp : keep,
  script : removeHandler,
  section : unwrapHandler,
  select : removeHandler,
  small : keep,
  span : unwrapHandler,
  strike : keep,
  strong : keep,
  style : removeHandler,
  st1 : unwrapHandler,
  sub : keep,
  summary : keep,
  sup : keep,
  vg : keep,
  table : keep,
  tbody : keep,
  td : keep,
  tfood : keep,
  th : keep,
  thead : keep,
  time : keep,
  title : removeHandler,
  tr : keep,
  track : keep,
  tt : keep,
  u : keep,
  ul : keep,
  'var' : keep,
  video : keep,
  wbr : keep
};

// Specialized handlers

handlers.a = function(anchor, base) {
  if(!anchor.href) return UNWRAP;
  anchor.href = URI.resolve(base, URI.parse(anchor.href));
  anchor.target = '_blank';
  return RETAIN;
};

handlers.embed = function(element, base) {
  if(element.src) {
    var src = URI.parse(element.src);
    
    // youtube http>https
    if(src.host && src.scheme != 'https' &&  
      src.host.indexOf('www.youtube.com') == 0) {
      src.scheme = 'https';
      element.src = URI.toString(src);
    } 
    
    if(!src.scheme) {
      element.src = URI.resolve(base, src);
    }
  }

  return RETAIN_RAW;
};

handlers.iframe = function(iframe, base) {
  if(iframe.src) {
    var uri = URI.parse(iframe.src);
    if(!uri.scheme) {
      console.log('Resolving relative iframe URI to %S', URI.resolve(base, uri));
      iframe.src = URI.resolve(base, uri);
    }
  }

  return RETAIN_RAW;
};

handlers.img = function(image, base) {
  if(!image.src) return REMOVE;
  
  var url = URI.parse(image.src);
  if(!url.scheme) {
    image.src = URI.resolve(base, url);
  }

  if(image.alt && image.alt.trim().length == 0)
    delete image.alt;

  return RETAIN;
};

handlers.object = function(obj, base) {
  if(obj.src) {
    var uri = URI.parse(obj.src);
    if(!uri.scheme) {
      obj.src = URI.resolve(base, uri);
    }
  }

  return RETAIN_RAW;
};


exports.unwrap = unwrap;
exports.sanitize = sanitize;

}(this));