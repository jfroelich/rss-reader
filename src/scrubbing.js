// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Functions for sanitizing, removing boilerplate

function calamineIsRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

function calamineFilterElementAttributes(element) {

  var removables = Array.prototype.filter.call(
    element.attributes,
    calamineIsRemovableAttribute
  );

  var removeAttribute = Element.prototype.removeAttribute.bind(element, element);
  removables.forEach(removeAttribute);
}

/**
 * Returns a DocumentFragment
 */
function calamineTransformDocument(doc, options) {
  options = options || {};

  // TODO: review gebtn, maybe i do not need to keep calling it?
  // e.g. maybe i should just do a single querySelectorAll instead if its not-live?
  // or is it better to re-call it to avoid read-after-delete issues?

  var body = doc.body;

  calaminePreprocessDocument(doc);
  calamineExtractFeaturesInDocument(doc);

  lucu.element.forEach(body.getElementsByTagName('*'), scoreElement);
  lucu.element.forEach(body.getElementsByTagName('*'), applySiblingBias);

  // Remove attributes
  if(options.FILTER_ATTRIBUTES) {
    lucu.element.forEach(body.getElementsByTagName('*'), calamineFilterElementAttributes);
  }

  body.score = -Infinity;
  var bestElement = Array.prototype.reduce.call(body.getElementsByTagName('*'), function(previous, current) {
    // Favor previous, so use > not >=
    return current.score > previous.score ? current : previous;
  }, body);

  var SELECTOR_UNWRAPPABLE = 'a:not([href]),article,big,blink,'+
    'body,center,details,div,font,form,help,html,insert,label,'+
    'legend,nobr,noscript,section,small,span,tbody,thead';

  if(options.UNWRAP_UNWRAPPABLES) {
    var unwrappableElements = body.querySelectorAll(SELECTOR_UNWRAPPABLE);
    lucu.element.forEach(unwrappableElements, function(element) {
      if(element != bestElement) {
        lucu.element.unwrap(element);
      }
    });
  }

  // Expose some attributes for debugging
  lucu.element.forEach(body.getElementsByTagName('*'), function(element) {
    options.SHOW_BRANCH && element.branch &&
      element.setAttribute('branch', element.branch);
    options.SHOW_ANCHOR_DENSITY && element.anchorDensity &&
      element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
    options.SHOW_CHAR_COUNT && element.charCount &&
      element.setAttribute('charCount', element.charCount);
    options.SHOW_COPYRIGHT_COUNT && element.copyrightCount &&
      element.setAttribute('copyrightCount', element.copyrightCount);
    options.SHOW_DOT_COUNT && element.dotCount &&
      element.setAttribute('dotCount', element.dotCount);
    options.SHOW_IMAGE_BRANCH && element.imageBranch &&
      element.setAttribute('imageBranch', element.imageBranch);
    options.SHOW_PIPE_COUNT && element.pipeCount &&
      element.setAttribute('pipeCount', element.pipeCount);
    options.SHOW_SCORE && element.score &&
      element.setAttribute('score', element.score.toFixed(2));
  });

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';
    }
  }

  // TODO: resolve relative href and src attributes
  var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';

  // Build and return the results
  var results = doc.createDocumentFragment();
  if(bestElement == body) {

    // TODO: bind Node.prototype.appendChild instead here
    var forEach = Array.prototype.forEach;
    forEach.call(body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }
  return results;
}

// Preps document for analysis
// TODO: move iframe from blacklist to whitelist once supported
function calaminePreprocessDocument(doc) {

  var body = doc.body;
  var forEach = Array.prototype.forEach;

  lucu.node.forEach(body, NodeFilter.SHOW_COMMENT, lucu.node.remove);

  var SELECTOR_BLACKLIST = 'applet,base,basefont,button,'+
    'command,datalist,dialog,embed,fieldset,frame,frameset,'+
    'html,head,iframe,input,legend,link,math,meta,noframes,'+
    'object,option,optgroup,output,param,script,select,style,'+
    'title,textarea';

  var SELECTOR_WHITELIST = 'a,abbr,acronym,address,area,'+
    'article,aside,audio,b,bdi,bdo,big,br,blockquote,'+
    'canvas,caption,center,cite,code,col,colgroup,'+
    'command,data,details,dir,dd,del,dfn,div,dl,dt,em,'+
    'entry,fieldset,figcaption,figure,font,footer,header,'+
    'help,hgroup,hr,h1,h2,h3,h4,h5,h6,i,img,ins,insert,'+
    'inset,label,li,kbd,main,mark,map,meter,nav,nobr,'+
    'noscript,ol,p,pre,progress,q,rp,rt,ruby,s,samp,section,'+
    'small,span,strike,strong,st1,sub,summary,sup,vg,table,'+
    'tbody,td,tfood,th,thead,time,tr,track,tt,u,ul,var,video,'+
    'wbr';

  var allElements = body.querySelectorAll('*');
  lucu.element.forEach(allElements, function(element) {

    // Remove any element in the blacklist
    if(element.matches(SELECTOR_BLACKLIST)) {
      return lucu.node.remove(element);
    }

    // Remove any element not in the whitelist
    if(!element.matches(SELECTOR_WHITELIST)) {
      return lucu.node.remove(element);
    }

    // Remove sourceless images
    if(element.matches('img:not([src])')) {
      return lucu.node.remove(element);
    }

    // Must occur before visibility checks to deal with
    // template unhiding techniques
    if(element.matches('noscript')) {
      return lucu.element.unwrap(element);
    }

    // Remove invisible elements
    if(lucu.element.isInvisible(element)) {
      return lucu.node.remove(element);
    }

    // Remove one-dimensional images
    if(element.matches('img')) {
      if(element.width === 1 || element.height === 1) {
        return lucu.node.remove(element);
      }
    }
  });

  // BUGGY: in process of fixing
  // lucu.element.forEach(doc.body.querySelectorAll('br,hr'), calamineTransformRuleElement);

  // Marks code/pre elements as whitespaceImportant and then marks all direct and indirect
  // descendant elements as whiteSpaceImportant. Propagating this property from the top
  // down (cascading) enables the trimNode function to quickly determine whether its
  // nodeValue is trimmable, as opposed to having the trimNode function search each text
  // node's axis (path from root) for the presence of a pre/code element.
  lucu.element.forEach(body.querySelectorAll('code,pre'), function(element) {
    element.whitespaceImportant = 1;
    lucu.element.forEach(element.getElementsByTagName('*'), function(descendantElement) {
      descendantElement.whitespaceImportant = 1;
    });
  });

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  // Trim text nodes. If the text node is between two inline elements, it is not
  // trimmed. If the text node follows an inline element, it is right trimmed. If
  // the text node precedes an ineline element, it is left trimmed. Otherwise the
  // nodeValue is fully trimmed. Then, if the nodeValue is empty, remove the node.
  lucu.node.forEach(body, NodeFilter.SHOW_TEXT, function(node) {
    if(!node.parentElement.whitespaceImportant) {
      if(lucu.element.isInline(node.previousSibling)) {
        if(!lucu.element.isInline(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimRight();
        }
      } else if(lucu.element.isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimLeft();
      } else {
        node.nodeValue = node.nodeValue.trim();
      }

      if(!node.nodeValue) {
        node.remove();
      }
    }
  });

  // TODO: cleanup the whitespaceImportant expando?

  // Now remove all empty-like elements from the document. If removing
  // an element would change the state of the element's parent to also
  // meet the empty-like criteria, then the parent is also removed, and
  // so forth, up the hierarchy, but stopping before doc.body.
  // NOTE: using :empty would not produce the desired behavior

  // TODO: removes should happen only once on the shallowest
  // parent. If this were called on a live doc we would be causing
  // several unecessary reflows. For example, in the case of
  // <div><p></p><p></p></div>, there are 3 remove operations,
  // when only 1 needed to occur. To do this, this needs
  // to be fundamentally refactored. Removes should not occur
  // on the first pass over the elements. This, btw, would remove the
  // ugliness of using a map function with a side effet. Instead, start by
  // identifying all of the empty leaves. Then, for each leaf, traverse
  // upwards to find the actual element to remove. Be cautious
  // about simply checking that parent.childElementCount == 1 to find
  // a removable parent because it is false in the case that two
  // or more empty-leaves share the same parent. The criteria instead is
  // that a parent is removable if all of its children are removable.
  // So we need to go up 1, then query all direct children. But that is
  // kind of redundant since we already identified the children, so that
  // still might need improvement.

  allElements = body.getElementsByTagName('*');
  var emptyLikeElements = lucu.element.filter(allElements, function(element) {
    return !element.firstChild && !lucu.element.isLeafLike(element);
  });

  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack. It is kinda DRY.

  // Remove all the empty children and shove all the parents on the stack
  var stack = emptyLikeElements.map(function(element) {
    var parentElement = element.parentElement;
    parentElement.removeChild(element);
    return parentElement;
  }).filter(function(element) {
    return element != body;
  });

  var parentElement, grandParentElement;

  // NOTE: stack.length might have a really surprising issue, I forget
  // exactly but there is possibly something unexpected regarding
  // popping elements from an array until it is empty, like,
  // the length gets incorrectly updated or something. Something I was
  // reading on stackoverflow about emptying arrays.

  while(stack.length) {
    parentElement = stack.pop();
    if(!parentElement.firstChild) {
      grandParentElement = parentElement.parentElement;
      if(grandParentElement) {
        grandParentElement.removeChild(parentElement);
        if(grandParentElement != body)
          stack.push(grandParentElement);
      }
    }
  }
}

function calamineExtractFeaturesInDocument(doc) {

  var body = doc.body;
  var forEach = Array.prototype.forEach;

  // Extract text features for text nodes and then propagate those properties
  // upward in the dom (up to root)
  lucu.node.forEach(body, NodeFilter.SHOW_TEXT, function deriveTextFeatures(textNode) {
    var parent = textNode.parentElement;

    // TODO: this should be discrete not continuous
    parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(textNode.nodeValue) ? 1 : 0;
    parent.dotCount = lucu.string.countChar(textNode.nodeValue,'\u2022');
    parent.pipeCount = lucu.string.countChar(textNode.nodeValue,'|');

    var charCount = textNode.nodeValue.length - textNode.nodeValue.split(/[\s\.]/g).length + 1;

    while(parent != body) {
      parent.charCount = (parent.charCount || 0) + charCount;
      parent = parent.parentElement;
    }
  });

  // Extract anchor features. Based on charCount from text features
  lucu.element.forEach(body.getElementsByTagName('a'), function deriveAnchorFeatures(anchor) {
    var parent = anchor.parentElement;

    if(anchor.charCount && anchor.hasAttribute('href')) {
      anchor.anchorCharCount = anchor.charCount;

      while(parent != body) {
        parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
        parent = parent.parentElement;
      }
    }
  });

  // Store id and class attribute values before attributes are removed
  lucu.element.forEach(body.getElementsByTagName('*'), function (element) {
    var text = ((element.getAttribute('id') || '') + ' ' +
      (element.getAttribute('class') || '')).trim().toLowerCase();

    if(text) {
      element.attributeText = text;
    }
  });

  // Cache a count of siblings and a count of prior siblings
  lucu.element.forEach(body.getElementsByTagName('*'), function(element) {
    element.siblingCount = element.parentElement.childElementCount - 1;
    element.previousSiblingCount = 0;
    if(element.siblingCount) {
      var sibling = element.previousElementSibling;
      while(sibling) {
        element.previousSiblingCount++;
        sibling = sibling.previousElementSibling;
      }
    }
  });
}


/**
 * Apply our 'model' to an element. We generate a 'score' that is the
 * sum of several terms.
 */
function scoreElement(element) {

  var root = element.ownerDocument.body;

  element.score = element.score || 0;

  if(element.charCount && !lucu.element.isLeafLike(element)) {
    element.anchorDensity = element.anchorCharCount / element.charCount;

    if(element.charCount > 1000) {
      if(element.anchorDensity > 0.35) {
        element.branch = 1;
        element.score += 50;
      } else if(element.anchorDensity > 0.2) {
        element.branch = 9;
        element.score += 100;
      } else if (element.anchorDensity > 0.1) {
        element.branch = 11;
        element.score += 100;
      } else if(element.anchorDensity > 0.05) {
        element.branch = 12;
        element.score += 250;
      } else {
        element.branch = 2;
        element.score += 300;
      }
    } else if(element.charCount > 500) {
      if(element.anchorDensity > 0.35) {
        element.branch = 3;
        element.score += 30;
      } else if(element.anchorDensity > 0.1) {
        element.branch = 10;
        element.score += 180;
      } else {
        element.branch = 4;
        element.score += 220;
      }
    } else if(element.charCount > 100) {
      if(element.anchorDensity > 0.35) {
        element.branch = 5;
        element.score += -100;
      } else {
        element.branch = 6;
        element.score += 60;
      }
    } else {
      if(element.anchorDensity > 0.35) {
        element.branch = 7;
        element.score -= 200;
      } else if(isFinite(element.anchorDensity)) {
        element.branch = 8;
        element.score += 20;
      } else {
        element.branch = 8;
        element.score += 5;
      }
    }
  }

  if(element.matches('img')) {

    var imageDescription = (element.getAttribute('alt') || '').trim();
    if(!imageDescription) imageDescription = (element.getAttribute('title') || '').trim();
    if(imageDescription) {
      // Award those images with alt or title text as being more
      // likely to be content. Boilerplate images are less likely to
      // have supporting text.
      element.score += 30;

      // Reward its parent
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }

      // TODO: rather than an arbitrary amount, use keyword bias and also
      // consider a length based bias. If length based used the greater length
      // of either alt or title, do not just consider alt length, which this
      // branch precludes atm.
    }

    if(element.parentElement && element.parentElement.matches('figure')) {
      var figCaptionNodeList = element.parentElement.getElementsByTagName('figcaption');
      if(figCaptionNodeList && figCaptionNodeList.length) {
        var firstFigCaption = figCaptionNodeList[0];
        var firstFigCaptionText = firstFigCaption.textContent;
        if(firstFigCaptionText) firstFigCaptionText = firstFigCaptionText.trim();
        if(firstFigCaptionText.length) {
          element.score += 30;
          if(element.parentElement && element.parentElement != root) {
            element.parentElement.score = (element.parentElement.score || 0) + 10;
          }
        }
      }
    }

    var area = lucu.image.getArea(element);
    if(!isFinite(area)) {
      // The only way to do this synchronously is to have
      // the dimensions be explicitly set when fetched prior to calling transform.
      // Which means the DOM must be inspected and we have to wait for another
      // set of requests to complete prior to this. Calamine should not be
      // the module responsible for determining image size.
      // I think it would make sense to decouple HTML fetching in FeedHttpRequest
      // into a separate HTMLHttpRequest, which itself does not invoke its async
      // callback until its inspected the doc, found all images without width or
      // height, fetched those images, and set width or height.
      element.imageBranch = 1;
      element.score += 100;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 100;
      }
    } else if(area > 1E5) {
      element.imageBranch = 2;
      element.score += 150;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 50000) {
      element.imageBranch = 3;
      element.score += 150;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 10000) {
      element.imageBranch = 4;
      element.score += 70;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 70;
      }
    } else if(area > 3000) {
      element.imageBranch = 5;
      element.score += 30;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else if(area > 500) {
      element.imageBranch = 6;
      element.score += 10;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else {
      element.imageBranch = 7;
      element.score -= 10;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) - 10;
      }
    }
  }

  element.score += element.siblingCount ?
    2 - 2 * element.previousSiblingCount / element.siblingCount : 0;
  element.score += element.siblingCount ?
    2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) /
      (element.siblingCount / 2) )  : 0;

  var TAG_NAME_BIAS = {
    a:-1, address:-3, article:100, aside:-200, blockquote:3, button:-100, dd:-3,
    div:20, dl:-10, dt:-3, figcaption: 10, figure: 10, footer:-20, font:0, form: -20,
    header: -5, h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
    ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:-3, tr:1, th:-3, ul:-20
  };

  element.score += TAG_NAME_BIAS[element.localName] || 0;

  var ID_CLASS_BIAS = {
    about: -35,
    'ad-': -100,
    ads: -50,
    advert: -100,
    article: 100,
    articleheadings: -50,
    attachment: 20,
    author: 20,
    blog: 20,
    body: 50,
    brand: -50,
    breadcrumbs: -20,
    button: -100,
    byline: 20,
    carousel: 30,
    combx: -20,
    comic: 75,
    comment: -300,
    community: -100,
    component: -50,
    contact: -50,
    content: 50,
    contenttools: -50,
    date: -50,
    dcsimg: -100,
    dropdown: -100,
    entry: 50,
    excerpt: 20,
    facebook: -100,
    fn:-30,
    foot: -100,
    footnote: -150,
    google: -50,
    head: -50,
    hentry:150,
    inset: -50,
    insta: -100,
    left: -75,
    legende: -50,
    license: -100,
    link: -100,
    logo: -50,
    main: 50,
    mediaarticlerelated: -50,
    menu: -200,
    menucontainer: -300,
    meta: -50,
    nav: -200,
    navbar: -100,
    pagetools: -50,
    parse: -50,
    pinnion: 50,
    popular: -50,
    popup: -100,
    post: 50,
    'post-attributes': -50,
    power: -100,
    print: -50,
    promo: -200,
    recap: -100,
    relate: -300,
    replies: -100,
    reply: -50,
    retweet: -50,
    right: -100,
    scroll: -50,
    share: -200,
    'share-tools': -100,
    shop: -200,
    shout: -200,
    shoutbox: -200,
    side: -200,
    sig: -50,
    social: -200,
    socialnetworking: -250,
    source:-50,
    sponsor: -200,
    story: 50,
    storytopbar: -50,
    strycaptiontxt: -50,
    stryhghlght: -50,
    strylftcntnt: -50,
    stryspcvbx: -50,
    subscribe: -50,
    summary:50,
    tag: -100,
    tags: -100,
    text: 20,
    time: -30,
    timestamp: -50,
    title: -100,
    tool: -200,
    twitter: -200,
    txt: 50,
    'utility-bar': -50,
    vcard: -50,
    week: -100,
    welcome_form: -50,
    widg: -200,
    zone: -50
  };

  // This is done on the ASSUMPTION that it yields better performance
  // regardless of whether the performance is even bad in the first place
  var ID_CLASS_KEYS = Object.keys(ID_CLASS_BIAS);
  var ID_CLASS_VALUES = ID_CLASS_KEYS.map(function(key) {
    return ID_CLASS_BIAS[key];
  });

  if(element.attributeText) {
    element.score += ID_CLASS_KEYS.reduce(function(sum, key, index) {
      return element.attributeText.indexOf(key) > -1 ?
        sum + ID_CLASS_VALUES[index] : sum;
    }, 0);

    // TODO: propagate partial attribute text bias to children, in the same
    // way that certain ancestor elements bias their children? After all,
    // <article/> should be nearly equivalent to <div id="article"/>
  }

  element.score += -20 * (element.copyrightCount || 0);
  element.score += -20 * (element.dotCount || 0);
  element.score += -10 * (element.pipeCount || 0);


  var forEach = Array.prototype.forEach;


  var ANCESTOR_BIASES = {
    nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
    dl:-5, p:10, blockquote:10, pre:10, code:10
  };
  var ancestorBias = ANCESTOR_BIASES[element.localName];
  ancestorBias && forEach.call(element.getElementsByTagName('*'), function(childElement) {
    childElement.score = (childElement.score || 0) + ancestorBias;
  });

  var DESCENDANT_BIASES = {
    p:5, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
    sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
    strong:1, b:1
  };
  var descendantBias = DESCENDANT_BIASES[element.localName];
  if(descendantBias && element.parentElement != root) {
    element.parentElement.score = (element.parentElement.score || 0) + descendantBias;
  }
}


/**
 * Propagate scores to nearby siblings. Look up to 2 elements
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their
 * context.
 *
 * TODO: instead of biasing the siblings based on the element,
 * bias the element itself based on its siblings. Rather, only
 * bias the element itself based on its prior sibling. That way,
 * we can bias while iterating more easily because we don't have to
 * abide the requirement that nextSibling is scored. Then it is
 * easy to incorporate this into the scoreElement function
 * and deprecate this function. In my head I am thinking of an analogy
 * to something like a YACC lexer that avoids doing peek operations
 * (lookahead parsing). We want something more stream-oriented.
 */
function applySiblingBias(element) {
  var elementBias = element.score > 0 ? 5 : -5;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
    }
  }
}


// Trying to break apart break rule elements by block
// UNDER DEVELOPMENT
function calamineTestSplitBR(str) {
  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

  var isInline = function(element) {
    return element.matches('a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
      'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var');
  };

  var insertAfter = function(newElement, oldElement) {
    if(oldElement.nextSibling) {
      oldElement.parentElement.insertBefore(newElement, oldElement.nextSibling);
    } else {
      oldElement.parentElement.appendChild(newElement);
    }
  };

  var peek = function(arr) {
    return arr[arr.length - 1];
  }

  var splitBlock = function(element) {

    var root = element.ownerDocument.body;

    // Find the path from the element to the first blocking element.
    var parent = element.parentElement;
    var path = [parent];
    while(isInline(parent)) {
      parent = parent.parentElement;
      path.push(parent);
    }

    if(peek(path) == root) {
      // We could have inline elements or text siblings
      // We have to create artificial block parents
      //var prev = doc.createElement('p');
      //var next = doc.createElement('p');

      return;
    }

    // Rebuilt the path and previous siblings
    //while(path.length) {
     // parent = path.pop();
    //}
  };

  Array.prototype.forEach.call(doc.body.getElementsByTagName('br'), splitBlock);
  return doc.body.innerHTML;
}



/*

TODO: unwrap javascript: anchors

TODO: support iframes and embed objects and audio/video
TODO: for all iframes, set sandbox attribute?
TODO: refactor to use block generation. Group list items together. Group
dds together, etc.
TODO: refactor to use block weighting. The return signature is simply
those blocks above a minimum threshold, which could be based on a
percentage of blocks to return value. But this time use the element
weighting technique. Consider treating divs as inline and using
only certain block parents (e.g. look for ul/ol/p/img/iframe as the only
allowable block segments).
TODO: do not necessarily exclude textnodes that are immediate children of body.
All top level text should probably be converted to paragraphs before scoring.
TODO: include other proximate or high scoring elements outside of the
best element, then rescan and filter out any extreme boilerplate
such as certain lists or ads. When building the frag, consider removing
each element from the original body such that each successive search for
another element does not have perform intersection tests.
TODO: the more I think about the above, the more I think I should go
back to blocks (which would simplify BR split), but this time add in
hierarchical weighting. The crux of the problem then becomes how
pick the blocks to return. I would have to incorporate some better
all blocks in this element type of biasing that promotes blocks like
they do now, but also get rid of upward propagation.
NOTE: this wouldn't simplify the BR transform, that is still screwed up
NOTE: The fundamental problem is that I am not obtaining "all" of the desired
elements from the age because sometimes they are not all in the same block.
And when I do get the parent element right, sometimes I still end up
getting alot of nested boilerplate. At that point I would need to filter
the boilerplate, at which point I am nearly back to block score.

TODO: look into alternatives to expandos (using dom as the dataset). There are reported
issues, warnings against extending native host objects, performance warnings against
shape changes, etc.
1) create a single custom object per element during feature extraction. store all
custom properties in this single custom object. Then, when all is said and done,
use delete node.customObjectName on all nodes, and then produce the results. This
ensures, even if it is not a problem, that no added references remain, so there is
no risk of keeping around unwanted references later
2) do not store any custom properties in the nodes. Separately store a set of properties
that contains references to nodes, like a big wrapper. Then just nullify or not return to
let the references be eventually gced. jquery accomplishes this by giving element a
GUID, then using the GUID to map between the element object and its cached reference
in a corresponding wrapper object. Gross.
3) Use attributes. This would not work. We need properties for text nodes, which are
not elements, and thus do not have attributes. Also, attributes are strings, and we
want to use numbers and booleans and other primitives, leading to alot of unecessary
type coercion.
4) Use data-* attirbutes. This again would not work, for all the same reasons as #3.
5) use several custom properties. make sure not to create references to elements, only
use separate primitive-like values (although those may turn into objects depending on how
they are used, like true.toString()).make sure to cleanup? cleanup may not even be
necessary. really it depends on underestanding how chrome deals with non-native properties
of elements. one concern is that chrome may not even provide in-memory objects for nodes
until those nodes are accessed, and by setting custom properties, it flags that the node has
to remain in mem, which means that by setting any one custom property on a node, it make
it persist in mem. the second concern is the dereferencing, whether the custom property
can be a contributing factor in preventing GC after the node is detached from the DOM.

According to http://canjs.com/docco/node_lists.html, trying to set an expando on a
node in certain browsers causes an exception
Good explanation of the basic leaks:
http://www.javascriptkit.com/javatutors/closuresleak/index3.shtml
*/