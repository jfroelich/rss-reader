
// TODO: do I even need to pass in strBaseURL to sanitize? 
// Can we set it as a property in doc in the caller, and use the URL object 
// created from the doc parameter?
// Now that I think about it, while it is good perf to do the resolution here,
// relative url resolution really has nothing to do with sanitization. Maybe
// it does not belong here?

// TODO: remove all empty elements, like <div></div> or <p></p>

var sanitizer = {};

// Sanitize the children of a node.
sanitizer.sanitize = function(baseURLString, rootNode, contentFilterRules) {
  
  var baseURI = URI.parse(baseURLString);
  
  var nodeHandler = function(node) {    
    return sanitizer.scrubNode(node, baseURI, contentFilterRules);
  };

  this.walk(rootNode, nodeHandler);
};

// Walking behavior constants
sanitizer.RETAIN_ = 0;
sanitizer.UNWRAP_ = 1;
sanitizer.REMOVE_ = 2;

// Walk a live DOM, calling callback for each node (if available)
sanitizer.walk = function(rootNode, callback) {
  var node = rootNode.firstChild, prev = node, walking = !!node, result;
  while(walking) {
    result = callback(prev = node);
    if(result !== this.REMOVE_ && node.firstChild) {
      node = node.firstChild;
    } else {
      while(walking && !node.nextSibling) {
        walking = node != rootNode;
        node = node.parentNode;
      }
      node = node.nextSibling;
    }

    if(result == this.UNWRAP_) {
      this.unwrap(prev);
    } else if(result == this.REMOVE_) {
      prev.parentNode.removeChild(prev);
    }
  }
};

// Returns true if a rule matches a node
sanitizer.evaluateRule = function(rule, node) {
  if(rule.tag && rule.re && rule.tag.toLowerCase() == node.localName.toLowerCase()) {
    var attr = node.getAttribute(rule.attr);
    if(attr) {
      return rule.re.test(attr);
    }
  }
};

sanitizer.applyContentFilterRules = function(node, rules) {
  var matched = collections.any(rules, function(rule) {
    return sanitizer.evaluateRule(rule, node);
  });
  
  return matched ? this.REMOVE_ : this.RETAIN_;
};



sanitizer.scrubNode = function(node, baseURI, contentFilterRules) {
  if(node.nodeType == Node.COMMENT_NODE) {
    return sanitizer.REMOVE_;
  }

  if(node.nodeType == Node.ELEMENT_NODE) {
    return sanitizer.scrubElement(node, baseURI, contentFilterRules);
  }

  if(node.nodeType == Node.TEXT_NODE) {
    return sanitizer.scrubTextNode(node);
  }

  console.warn('Unhandled node type (%s)', node.nodeType);
  console.dir(node);
  return sanitizer.REMOVE_;
};


sanitizer.scrubElement = function(node, base, contentFilterRules) {
  // Remove elements not in the whitelist
  if(!sanitizer.ELEMENTS_WHITELIST_[node.localName]) {
    return sanitizer.REMOVE_;
  }

  // Remove elements in the blacklist
  if(sanitizer.ELEMENTS_BLACKLIST_[node.localName]) {
    return sanitizer.REMOVE_;
  }

  // Remove elements according to user defined filtering rules
  if(sanitizer.applyContentFilterRules(node,contentFilterRules) == sanitizer.REMOVE_) {
    return sanitizer.REMOVE_;
  }

  // Unwrap certain elements (remove but keep children)
  if(sanitizer.ELEMENTS_UNWRAPPABLE_[node.localName]) {
    return sanitizer.UNWRAP_;
  }

  // Scrub attributes.
  if(!sanitizer.ELEMENTS_KEEP_ATTRIBUTES_[node.localName]) {
    sanitizer.scrubAttributes(node);  
  }

  // Resolve relative urls
  if(sanitizer.ELEMENTS_RESOLVABLE_[node.localName]) {
    sanitizer.resolveRelativeURL(node, base);
  }

  // Further processing
  if(node.localName == 'a') {
    return sanitizer.scrubAnchor(node);
  }

  if(node.localName == 'img') {
    return sanitizer.scrubImage(node);
  }

  if(node.localName == 'embed') {
    return sanitizer.scrubEmbed(node);
  }

  return sanitizer.RETAIN_; 
};

sanitizer.scrubAnchor = function(node) {
  var href = node.getAttribute('href');
        
  // Unwrap anchors without href values.
  if(!href) {
     return sanitizer.UNWRAP_;
  }
        
  // Remove \s+javascript\s+:
  // TODO: startsWith is too simple.
  // Note: since we do not allow inline scripts this does not really matter.
  if(strings.startsWith(href.trim().toLowerCase(), 'javascript:')) {
    node.removeAttribute('href');
    return sanitizer.UNWRAP_;
  }
        
  // Force links to open in a new window
  node.setAttribute('target','_blank');
  return sanitizer.RETAIN_;
};

sanitizer.scrubImage = function(node) {
  
  // Images without src values are removable
  if(!node.getAttribute('src')) {
    return sanitizer.REMOVE_;
  }

  // TODO: consider removing width/height attributes.
  return sanitizer.RETAIN_;
};

sanitizer.scrubEmbed = function(node) {
  // Rewrite youtube embeds to always use https so 
  // as to comply with Chrome's mandatory content security policy
  var src = node.getAttribute('src');
  if(src) {
    var srcURI = URI.parse(src.trim());
    if(srcURI && sourceURI.host && sourceURI.scheme != 'https' &&  
      sourceURI.host.indexOf('www.youtube.com') == 0) {
      sourceURI.scheme = 'https';
      node.setAttribute('src', URI.toString(sourceURI));
    }
  }
  
  return sanitizer.RETAIN_;
};


sanitizer.scrubAttributes = function(node) {

  collections.each(node.attributes, function(attribute) {

    if(!attribute || !attribute.name) {
      
      // TODO: This got fired about 50 times when testing subscribing to a new feed 
      // http://feeds.gawker.com/lifehacker/full 5/23/2014
      
      console.warn('attribute is undefined in scrub attributes');
      return;
    }

    // Remove unknown attributes that are not allowed
    if(!sanitizer.ALLOWED_ATTRIBUTES_[attribute.name]) {
      node.removeAttribute(attribute.name);
      return;
    }

    if(sanitizer.BOOLEAN_ATTRIBUTES_[attribute.name]) {
      attribute.value = '';
      return;
    }

    if(attribute.value) {
      
      // Trim and condense whitespace
      attribute.value = attribute.value.trim().replace(/\s+/g, ' ');

      // Non-boolean attributes without values can be removed.
      if(!attribute.value) {
        node.removeAttribute(attribute.name);
        return;
      }

      var lowercaseValue = attribute.value.toLowerCase();

      if(node.localName == 'script' && attribute.name == 'language' && 
        lowercaseValue == 'javascript') {
        node.removeAttribute(attribute.name);
        return;
      }

      if(node.localName == 'form' && attribute.name == 'method' && 
        lowercaseValue == 'get') {
        node.removeAttribute(attribute.name);
        return;
      }

      if(node.localName == 'input' && attribute.name == 'type' && 
        lowercaseValue == 'text') {
        node.removeAttribute(attribute.name);
        return;
      }

      if(node.localName == 'area' && attribute.name == 'shape' && 
        lowercaseValue == 'rect') {
        node.removeAttribute(attribute.name);
        return;
      }
    } else {
      node.removeAttribute(attribute.name);
    }
  });
};

sanitizer.scrubTextNode = function(node) {
  var text = node.textContent;
  
  // Normalize some whitespace
  text = text.replace('&nbsp;',' ');
  text = text.replace('&#160;', ' ');

  // Shrink multiple whitespace to single space
  // if not inside pre/code. For now we are only going to behave
  // properly if dealing with text nodes immediately under pre. The 
  // following does not deal with nodes nested under nodes nested 
  // under pre, which is valid HTML. So we can muck-up certain
  // pre formatted text but for now it is ok.

  if(node.parentNode && node.parentNode.localName == 'pre' || 
    node.parentNode.localName == 'code') {
  
    // dont mess with whitespace in pre/code blocks
    
  } else {
    // Strip lines (replace with space)
    // Normalize tabs.
    text = text.replace(/[\t\r\n]/g,' ');
    
    // Condense white space
    text = text.replace(/\s+/g,' ');
    
    // Trim
    text = text.trim();
  }
  
  if(!text) {
    return sanitizer.REMOVE_;
  }
  
  // Mutate
  node.textContent = text;
  return sanitizer.RETAIN_;
};


sanitizer.resolveRelativeURL = function(node, base) {
  
  // No point in doing anything without a base uri
  if(!base) {
    return;
  }

  var attributeName = node.localName == 'a' ? 'href' : 'src';
  var source = node.getAttribute(attributeName);

  // Missing attribute
  if(!source) {
    return;
  }

  var uri = URI.parse(source);
  
  // No need to try and resole urls that are absolute.
  if(uri.scheme) {
    return;
  }
  
  var resolvedString = URI.resolve(base, uri);
  node.setAttribute(attributeName, resolvedString);
};

// Replace a node with its children.
sanitizer.unwrap = function(node) {
  while(node.firstChild)
    node.parentNode.insertBefore(node.firstChild, node);
  node.parentNode.removeChild(node);  
};

sanitizer.ELEMENTS_KEEP_ATTRIBUTES_ = {
  applet:1,audio:1,embed:1,object:1,param:1,video:1
};

sanitizer.ELEMENTS_RESOLVABLE_ = {
  a:1,
  embed:1,
  iframe:1,
  img:1,
  audio:1,
  video:1,
  object:1,
  applet:1
};

sanitizer.ELEMENTS_UNWRAPPABLE_ = {
  article : 1,
  center : 1,
  details : 1,
  div : 1,
  font : 1,
  help : 1,
  insert : 1,
  label : 1,
  nobr : 1,
  noscript : 1,
  section : 1,
  span : 1,
  st1 : 1 
};


// Nodes in this list are always removed.
sanitizer.ELEMENTS_BLACKLIST_ = {
  base : 1,
  basefont : 1,
  command : 1,
  datalist : 1,
  dialog : 1,
  fieldset : 1,
  frame : 1,
  frameset : 1,
  html : 1,
  input : 1,
  legend : 1,
  link : 1,
  math : 1,
  meta : 1,
  noframes : 1,
  option : 1,
  optgroup : 1,
  output : 1,
  script : 1,
  select : 1,
  style : 1,
  title : 1
};


// A list of known nodes. Nodes not in this list are removed.
sanitizer.ELEMENTS_WHITELIST_ = {
  a: 1,
  abbr : 1,
  acronym : 1,
  address : 1,
  applet : 1,
  area : 1,
  article : 1,
  aside : 1,
  audio : 1,
  b : 1,
  base :1,
  basefont : 1,
  bdi : 1,
  bdo : 1,
  big : 1,
  br : 1,
  blockquote : 1,
  canvas : 1,
  caption : 1,
  center : 1,
  cite : 1,
  code : 1,
  col : 1,
  colgroup : 1,
  command : 1,
  data : 1,
  datalist : 1,
  details : 1,
  dialog : 1,
  dir : 1,
  dd : 1,
  del : 1,
  dfn : 1,
  div : 1,
  dl : 1,
  dt : 1,
  em : 1,
  embed: 1,
  entry : 1,
  fieldset : 1,
  figcaption : 1,
  figure : 1,
  font : 1,
  footer : 1,
  frame : 1,
  frameset : 1,
  header : 1,
  help : 1,
  hgroup : 1,
  hr : 1,
  h1 : 1,
  h2 : 1,
  h3 : 1,
  h4 : 1,
  h5 : 1,
  h6 : 1,
  html : 1,
  i : 1,
  iframe: 1,
  img: 1,
  input : 1,
  ins : 1,
  insert : 1,
  inset : 1,
  label : 1,
  legend : 1,
  li : 1,
  link : 1,
  kbd : 1,
  main : 1,
  mark : 1,
  map : 1,
  math : 1,
  meta : 1,
  meter : 1,
  nav : 1,
  nobr : 1,
  noframes : 1,
  noscript : 1,
  ol : 1,
  object: 1,
  option : 1,
  optgroup : 1,
  output : 1,
  p : 1,
  param : 1,
  pre : 1,
  progress : 1,
  q : 1,
  rp : 1,
  rt : 1,
  ruby : 1,
  s : 1,
  samp : 1,
  script : 1,
  section : 1,
  select : 1,
  small : 1,
  span : 1,
  strike : 1,
  strong : 1,
  style : 1,
  st1 : 1,
  sub : 1,
  summary : 1,
  sup : 1,
  vg : 1,
  table : 1,
  tbody : 1,
  td : 1,
  tfood : 1,
  th : 1,
  thead : 1,
  time : 1,
  title : 1,
  tr : 1,
  track : 1,
  tt : 1,
  u : 1,
  ul : 1,
  'var' : 1,
  video : 1,
  wbr : 1  
};

// Attributes allowed in any element
// TODO: consider CAJA style attributes per element instead of a 
// global list.
sanitizer.ALLOWED_ATTRIBUTES_ = {
  alt:1,href:1,src:1,target:1,title:1,valign:1
};

// This list is based on a list from 
// https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
sanitizer.BOOLEAN_ATTRIBUTES_ = {
  allowfullscreen:1,async:1,autofocus:1,autoplay:1,checked:1,compact:1,controls:1,
  declare:1,'default':1,defaultchecked:1,defaultmuted:1,defaultselected:1,
  defer:1,disable:1,draggable:1,enabled:1,formnovalidate:1,hidden:1,
  indeterminate:1,inert:1,ismap:1,itemscope:1,loop:1,multiple:1,muted:1,
  nohref:1,noresize:1,noshade:1,novalidate:1,nowrap:1,open:1,pauseonexit:1,
  readonly:1,required:1,reversed:1,scoped:1,seamless:1,selected:1,
  sortable:1,spellcheck:1,translate:1,truespeed:1,typemustmatch:1,
  visible:1
};
