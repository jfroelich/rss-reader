// Sanitize entry content

// Node handling behaviors when traversing a document's DOM, constants
var RETAIN = 0, UNWRAP = 1, REMOVE = 2, RETAIN_RAW = 3, REPLACE = 4;

// Attributes allowed in any element
var ALLOWED_ATTRIBUTES = {
  //'align': true,
  'alt':true,
  'href':true,
  'src':true,
  'target':true,
  'title':true,
  'valign':true
};

var COMMENT_NODE = Node.COMMENT_NODE, ELEMENT_NODE = Node.ELEMENT_NODE;

// Map between lowercase tagnames and handlers
var elementHandler = {};

// Initialize blacklist
var blacklist = {};
each([
  'javascript:',
  'http://ads.pheedo.com',
  'http://insight.adsrvr.org',
  'http://feeds.feedburner.com',
  'http://res3.feedsportal.com',
  'http://da.feedsportal.com',
  'http://pi.feedsportal.com',
  'http://share.feedsportal.com',
  'http://gizmodo.feedsportal.com'
], function(item) {
  var uo = URI.parse(item);
  blacklist[URI.toString({'scheme': uo.scheme,'host': uo.host})] = true;
});

function isBlacklisted(url) {
  var uo = URI.parse(url);
  return blacklist.hasOwnProperty(URI.toString({'scheme': uo.scheme, 'host': uo.host}));
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

  // Traverse the documents nodes, handling each node sequentially
  walk(doc.body, function(node) {
    
    if(node.nodeType == COMMENT_NODE) {
      // Strip comments
      return REMOVE;
    } else if(node.nodeType == ELEMENT_NODE) {
      var elementHandler = getHandler(node);
      if(elementHandler) {
        var result = elementHandler(node, baseURI);

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

  trimDocument(doc);
  return doc;
}

// Stackless DOM walk that supports some mutation
function walk(root, cb) {
  // We do not sanitize the root node. We actually iterate off of first child 
  // as the root node is merely our container, so that we do not have to check 
  // if we are at root each iteration. 
  var node = root.firstChild,
    // prev keeps track of the cursor as we iterate so that
    // we can manipulate the node after finding the next node to visit.
    // node represents the node at the cursor, or the next node to visit.
    prev = node,
    // walking initializes to true if we have nodes to iterate
    walking = !!node, 
    //result is a temp holder storing the return code so that
    // we can defer manipulation until after finding the next node.
    result;

  while(walking) {
    // Visit the node, store a pointer to the node
    result = cb(prev = node);

    if(result !== REMOVE && node.firstChild) {
      // Not removing the node, and it has children, so we traverse 
      // down in a depth first search manner
      node = node.firstChild;
    } else {
      // The node should be removed (in which case we want to skip its children)
      // or the node has no children

      // Backtrack up while the node has no siblings
      while(walking && !node.nextSibling) {
        
        // If we backtracked up to the root, we are done
        walking = node != root;
        
        // Go up one level
        node = node.parentNode;
      }
      
      // We either backtracked to the root, or the node has a sibling
      // we should visit on the next iteration
      node = node.nextSibling;
    }

    // Do deferred DOM manipulation
    if(result == UNWRAP) {
      unwrap(prev);
    } else if(result == REMOVE) {
      prev.parentNode.removeChild(prev);
    }
  }
}

// Trim leading and trailing content from a document
function trimDocument(doc) {
  var node = doc.body.firstChild, sibling;
  while(node && isTrimmableNode(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
  node = doc.body.lastChild;
  while(node && isTrimmableNode(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
}

// Returns true if the node is trimmable
// TODO: <p></p> or <p> \n </p>
function isTrimmableNode(node) {
  if(node.nodeType == Node.COMMENT_NODE) {
    return true;
  } else if(node.nodeType == Node.ELEMENT_NODE && node.nodeName == 'BR') {
    return true;
  } else if(node.nodeType == Node.TEXT_NODE) {
    node.textContent = node.textContent.trim();
    if(node.textContent.length == 0) {
      return true;
    }
  } else if(node.nodeType == Node.ELEMENT_NODE && node.nodeName == 'P') {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.
    
    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE && 
      node.firstChild.textContent.trim().length == 0) {
      // <p>whitespace</p>
      return true;
    }
  }
}

// TODO: rename to be more specific
function getHandler(element) {
  // localName is guaranteed lowercase (at least in Chrome)
  var elementName = element.localName;
  var colon = elementName.indexOf(':');
  if(colon != -1) {
    elementName = elementName.substring(colon + 1);
  }

  return elementHandler[elementName];
}

// Returns true if the given attribute is not a known attribute
function isUnknwownAttribute(attribute) {
  return !ALLOWED_ATTRIBUTES.hasOwnProperty(attribute.nodeName);
}

// Basic handlers

// The default behavior is RETAIN (not REMOVE)!
function defaultHandler() { return RETAIN; }

function removeHandler() { return REMOVE; }
function unwrapHandler() { return UNWRAP; }

// Basic handlers with logging
function unwrapAndWarnHandler(element) {
  console.warn(element.outerHTML);
  return unwrapHandler(element);
}

function retainAndWarnHandler(element) {
  //console.log(element.outerHTML);
  return RETAIN;
}

function removeAndWarnHandler(element) {
  //console.log(element.outerHTML);
  return REMOVE;
}


//////////////////////////////////////////////////////////////////////////////////////////
// Various element handlers

elementHandler.a = function(anchor, baseURIObj) {
  var href = anchor.getAttribute('href');
  if(href) {
    if(isBlacklisted(href)) {
      // Signal that the link should be removed
      return REMOVE;
    }

    // Resolve the link
    anchor.setAttribute('href', URI.resolve(baseURIObj, URI.parse(href)));

    // Force it to open a new window, always
    anchor.setAttribute('target', '_blank');

  } else {
    // A sourceless anchor is unwrappable
    return UNWRAP;
  }

  return RETAIN;
};

// todo: resolve relative source uri for applets?
elementHandler.applet = function(element, baseURI) {
  return RETAIN_RAW;
};

elementHandler.audio = retainAndWarnHandler;
elementHandler.canvas = retainAndWarnHandler;

elementHandler.embed = function(element) {
  // console.log(element.outerHTML);

  var source = element.getAttribute('src');
  if(source) {
    var sourceURI = URI.parse(source);
    if(sourceURI.host && sourceURI.host.indexOf('www.youtube.com') == 0 && sourceURI.scheme != 'https') {
      // console.log('HACK: Rewriting youtube URL to comply with CSP, %s', source);
      sourceURI.scheme = 'https';
      element.setAttribute('src', URI.toString(sourceURI));
    }
  }

  return RETAIN_RAW;
};


elementHandler.html = removeAndWarnHandler;

elementHandler.iframe = function(element, baseURI) {
  var source = element.getAttribute('src');
  if(source) {
    var uri = URI.parse(source);
    if(!uri.scheme) {
      var resolvedURI = URI.resolve(baseURI, uri);
      element.setAttribute('src', resolvedURI);
    }
  }
  
  return RETAIN_RAW;
}

// Special handling for images
elementHandler.img = function(image, baseURIObj) {

  var source = image.getAttribute('src');

  if(!source || isBlacklisted(source)) {
    return REMOVE;
  }

  if(baseURIObj) {
    var resolvedURI = URI.resolve(baseURIObj, URI.parse(source));
    image.setAttribute('src', resolvedURI);    
  } else {
    console.log('Missing base URI for image %s', source);
  }

  // Strip empty alt attributes
  var alternateText = image.getAttribute('alt');
  if(!alternateText || alternateText.trim().length == 0) {
    image.removeAttribute('alt');
  }

  return RETAIN;
};

elementHandler.link = removeAndWarnHandler;
elementHandler.meta = removeAndWarnHandler;
elementHandler.object = function(element) {
  return RETAIN_RAW;
};

elementHandler.param = function(element) {
  return RETAIN_RAW;
};

// We handle preformatted text layout issues with CSS
// instead of JS. We do not unwrap because whitespace
// indentation is important.
elementHandler.pre = function(element) {
  return RETAIN;
};

elementHandler.svg = retainAndWarnHandler;

elementHandler.title = removeAndWarnHandler;

elementHandler.video = retainAndWarnHandler;

['base','basefont','command','datalist','dialog','fieldset',
  'frame','frameset','input','legend','noframes','option',
  'optgroup','output','style','select','script','title'
].forEach(function(el) {
  elementHandler[el] = removeHandler;
});

['article','details','div','font','help','insert','label','nobr',
'noscript','section','span','st1'].forEach(function(el) {
    elementHandler[el] = unwrapHandler;
});

// note: Not sure whether inset is a real element but I keep seeing it
['abbr','acronym','address','area','aside','b','bdi','bdo','big',
  'br','blockquote','caption','center','cite','code','col','colgroup',
  'data','dir','dd','del','details','dfn','dl','dt','em','entry',
  'figcaption','figure','footer','header','hgroup','hr','h1','h2',
  'h3','h4','h5','h6','i','ins','inset','li','kbd','main','mark',
  'map','meter','nav','ol','p','progress','q','rp','rt','ruby','s',
  'samp','small','strike','strong','sub','summary','sup','table',
  'tbody','tfood','thead','td','th','time','tr','track','tt','u',
  'ul','var','wbr'].forEach(function(el) {
  elementHandler[el] = defaultHandler;
});

['math','mi','mn','mo','mtext','mspace','ms','mglyph','mrow','mfrac','msqrt',
'mroot','mstyle','merror','mpadded','mphantom','mfenced','menclose','msub',
'msup','msubsup','munder','mover','munderover','mmultiscripts','mtable','mlabeledtr',
'mtr','mtd','maligngroup','malignmark','maction','cn','ci','csymbol','apply','reln',
'fn','interval','inverse','condition','declare','lambda','compose','ident','domain',
'codomain','image','domainofapplication','piecewise','piece','otherwise','quotient',
'exp','factorial','divide','max','min','minus','plus','power','rem','times','root',
'gcd','and','or','xor','not','implies','forall','exists','abs','conjugate','arg',
'real','imaginary','lcm','floor','ceiling','eq','neq','gt','lt','geq','leq','equivalent',
'approx','factorof','int','diff','partialdiff','lowlimit','uplimit','bvar','degree',
'divergence','grad','curl','laplacian','set','list','union','intersect','in','notin',
'subset','prsubset','notsubset','notprsubset','setdiff','card','cartesianproduct','sum',
'product','limit','tendsto','exp','ln','log','sin','cos','tan','sec','csc','cot','sinh',
'cosh','tanh','sech','csch','coth','arcsin','arccos','arctan','arccosh','arccot','arccoth',
'arccsc','arccsch','arcsec','arcsech','arcsinh','arctanh','mean','sdev','variance','median',
'mode','moment','momentabout','vector','matrix','matrixrow','determinant','transpose',
'selector','vectorproduct','scalarproduct','outerproduct','annotation','semantics',
'annotation-xml','integers','reals','rationals','naturalnumbers','complexes','primes',
'exponentiale','imaginaryi','notanumber','true','false','emptyset','pi','eulergamma','infinity'
].forEach(function(el) {
  elementHandler[el] = defaultHandler;
});