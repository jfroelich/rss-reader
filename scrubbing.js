/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 *
 * TODO: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement.dataset
 * TODO: support for iframes and embed objects and audio/video
 * TODO: refactor to use block generation. Group lis together. Group
 * dds together, etc.
 * TODO: refactor to use block weighting. The return signature is simply
 * those blocks above a minimum threshold, which could be based on a
 * percentage of blocks to return value. But this time use the element
 * weighting technique. Consider treating divs as inline and using
 * only certain block parents (e.g. look for ul/ol/p/img/iframe as the only
 * allowable block segments).
 * TODO: do not necessarily exclude textnodes that are immediate children of body.
 * All top level text should probably be converted to paragraphs before scoring.
 * TODO: include other proximate or high scoring elements outside of the
 * best element, then rescan and filter out any extreme boilerplate
 * such as certain lists or ads. When building the frag, consider removing
 * each element from the original body such that each successive search for
 * another element does not have perform intersection tests.
 * TODO: the more I think about the above, the more I think I should go
 * back to blocks (which would simplify BR split), but this time add in
 * hierarchical weighting. The crux of the problem then becomes how
 * pick the blocks to return. I would have to incorporate some better
 * all blocks in this element type of biasing that promotes blocks like
 * they do now, but also get rid of upward propagation.
 * NOTE: this wouldn't simplify the BR transform, that is still screwed up
 * NOTE: The fundamental problem is that I am not obtaining "all" of the desired
 * elements from the age because sometimes they are not all in the same block.
 * And when I do get the parent element right, sometimes I still end up
 * getting alot of nested boilerplate. At that point I would need to filter
 * the boilerplate, at which point I am nearly back to block score.
 * TODO: performance testing, memory testing
 *
 * TODO: consider using element.dataset to store custom properties instead
 * of our own direct storage on native objects. Wary of performance impact.
 * See also http://www.w3.org/TR/2009/WD-html5-20090825/microdata.html.
 * NOTE: actually that would be pretty backwards, that is strings based. Also,
 * those properties stick around with every element even when I do not want
 * them to persist longer.
 *
 * TODO: custom properties added to DOM objects (or any object) are known in the dev community
 * as 'expando' properties.  Actually any property that was not explicitly defined as a
 * a part of the original object is an 'expando' property.
 *
 * More confusingly, since almost no object (DOM or basic {}), has a pre-defined property
 * named 'expando', the examples are written as object.expando= value, where the assignment
 * of a value to the .expando results in the definition of a new property in the object
 *
 * I am under the impression that it will not cause
 * memory leak issues, but it is not clear. It would cause a memory leak, for
 * example, if we did element.specialprop = element. This circular reference
 * would have to be deleted before the element could ever be garbage collected.
 * Currently I only attach primitives like booleans/numbers, not objects.
 * It is permissible to use expando properties. Setting a custom property
 * does not throw an error except in old versions of IE that I dont care about.
 *
 * Options:
 * 1) create a single custom object per element during feature extraction. store all
 * custom properties in this single custom object. Then, when all is said and done,
 * use delete node.customObjectName on all nodes, and then produce the results. This
 * ensures, even if it is not a problem, that no added references remain, so there is
 * no risk of keeping around unwanted references later
 * 2) do not store any custom properties in the nodes. Separately store a set of properties
 * that contains references to nodes, like a big wrapper. Then just nullify or not return to
 * let the references be eventually gced. jquery accomplishes this by giving element a
 * GUID, then using the GUID to map between the element object and its cached reference
 * in a corresponding wrapper object. Gross.
 * 3) Use attributes. This would not work. We need properties for text nodes, which are
 * not elements, and thus do not have attributes. Also, attributes are strings, and we
 * want to use numbers and booleans and other primitives, leading to alot of unecessary
 * type coercion.
 * 4) Use data-* attirbutes. This again would not work, for all the same reasons as #3.
 * 5) use several custom properties. make sure not to create references to elements, only
 * use separate primitive-like values (although those may turn into objects depending on how
 * they are used, like true.toString()).make sure to cleanup? cleanup may not even be
 * necessary. really it depends on underestanding how chrome deals with non-native properties
 * of elements. one concern is that chrome may not even provide in-memory objects for nodes
 * until those nodes are accessed, and by setting custom properties, it flags that the node has
 * to remain in mem, which means that by setting any one custom property on a node, it make
 * it persist in mem. the second concern is the dereferencing, whether the custom property
 * can be a contributing factor in preventing GC after the node is detached from the DOM.
 *
 * According to http://canjs.com/docco/node_lists.html, trying to set an expando on a
 * node in certain browsers causes an exception
 * Good explanation of the basic leaks:
 * http://www.javascriptkit.com/javatutors/closuresleak/index3.shtml
 *
 */
var calamine = (function() {
'use strict';

var filter = Array.prototype.filter,
reduce = Array.prototype.reduce,

/** Remove these elements, including children */
SELECTOR_REMOVABLE = 'applet,base,basefont,button,command,datalist,'+
'dialog,embed,fieldset,frame,frameset,head,iframe,img:not([src]),input,'+
'link,math,meta,noframes,object,option,optgroup,output,param,script,'+
'select,style,title,textarea',

/** Remove these elements, excluding children, if OPTIONS.UNWRAP_UNWRAPPABLE is set */
SELECTOR_UNWRAPPABLE = 'a:not([href]),big,blink,body,center,div,font,form,'+
'html,legend,small,span,tbody,thead',

/** Elements that should not be considered empty/textual */
SELECTOR_LEAFY = 'applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video',

/** Elements that exhibit display:inline behavior by default */
SELECTOR_INLINE = 'a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var',

SELECTOR_INLINE_SEPARATOR = 'br,hr',

SELECTOR_WHITESPACE_IMPORTANT = 'code,pre',

/** Bias lookup table for getTagNameBias */
TAG_NAME_BIAS = {
  a:-1, address:-3, article:100, aside:-200, blockquote:3, button:-100, dd:-3,
  div:20, dl:-10, dt:-3, figcaption: 10, figure: 10, footer:-20, font:0, form: -20,
  header: -5, h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
  ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:-3, tr:1, th:-3, ul:-20
},

ID_CLASS_BIAS = {
  about: -35, 'ad-': -100, ads: -50, advert: -100, article: 100,
  attachment: 20, author: 20, blog: 20, body: 50, brand: -50,
  button: -100, byline: 20, carousel: 30, comic: 75,
  comment: -300, component: -50, contact: -50, content: 50, dcsimg: -100,
  entry: 50, excerpt: 20, facebook: -100, fn:-30, foot: -100, google: -50,
  head: -50, hentry:150, insta: -100, left: -75, license: -100,
  link: -100, logo: -50, main: 50, menu: -200, meta: -50, nav: -200,
  parse: -50, pinnion: 50, post: 50, power: -100, promo: -200, recap: -100,
  relate: -300, right: -100, scroll: -50, share: -200, shop: -200,
  shout: -200, side: -200, sig: -50, social: -200, source:-50,
  sponsor: -200, story: 50, summary:50, tag: -100, text: 20, time:-30,
  title: -100,tool: -200, twitter: -200,txt: 50, week: -100, widg: -200,
  zone: -50
},

/** get an array for fast iteration */
ID_CLASS_KEYS = Object.keys(ID_CLASS_BIAS),

/** get an array for faster lookup (??) */
ID_CLASS_VALUES = ID_CLASS_KEYS.map(function(key) {
  return ID_CLASS_BIAS[key];
}),

/** Immediate parent elements are biased for containing these elements. */
DESCENDANT_BIAS = {
  p:5, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
  sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
  strong:1, b:1
},

/** These ancestor elements bias all descendants. */
ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10
};

/** public API */
return {
  transform: transformDocument
}

/**
 * Returns a DocumentFragment containing
 * the content element(s) of an HTMLDocument object
 */
function transformDocument(doc, options) {
  options = options || {};

  eachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);
  each(doc.body.querySelectorAll(SELECTOR_REMOVABLE), removeNode);

  // Always unwrap noscript elements pre processing. This must happen before
  // checking visibility.
  each(doc.body.querySelectorAll('noscript'), unwrapElement);

  each(doc.body.querySelectorAll('*'), filterInvisibleElement);
  each(doc.body.getElementsByTagName('img'), filter1DImage);

  // BUGGY: in process of fixing
  // each(doc.body.querySelectorAll(SELECTOR_INLINE_SEPARATOR), transformRuleElement);

  each(doc.body.querySelectorAll(SELECTOR_WHITESPACE_IMPORTANT), cascadeWhitespaceImportant);

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // TODO: if not whitespace important, nodeValue = nodeValue.replace(/\s+/g,' ');

  eachNode(doc.body, NodeFilter.SHOW_TEXT, trimAndMaybeRemoveTextNode);
  pruneEmptyElements(doc);

  eachNode(doc.body, NodeFilter.SHOW_TEXT, deriveTextFeatures);
  each(doc.body.getElementsByTagName('a'), deriveAnchorFeatures);
  each(doc.body.getElementsByTagName('*'), deriveAttributeTextFeatures);
  each(doc.body.getElementsByTagName('*'), deriveSiblingFeatures);
  each(doc.body.getElementsByTagName('*'), scoreElement);
  each(doc.body.getElementsByTagName('*'), applySiblingBias);

  if(options.FILTER_ATTRIBUTES) {
    each(doc.body.getElementsByTagName('*'), filterElementAttributes);
  }

  doc.body.score = -Infinity;
  var bestElement = reduce.call(doc.body.getElementsByTagName('*'),
    getHigherScoringElement, doc.body);

  if(options.UNWRAP_UNWRAPPABLES) {
    each(doc.body.querySelectorAll(SELECTOR_UNWRAPPABLE), function(element) {
      if(element != bestElement) {
        unwrapElement(element);
      }
    });
  }

  each(doc.body.getElementsByTagName('*'), function(element) {
    exposeAttributes(element, options);
  });

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';
    }
  }

  var results = doc.createDocumentFragment();
  if(bestElement == doc.body) {
    each(doc.body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }
  return results;
}

/**
 * Collects some basic textual properties of the node
 * and stashes them in the native object. Propagates the
 * properties up the DOM to doc.body.
 */
function deriveTextFeatures(textNode) {

  var root = textNode.ownerDocument.body,
    parent = textNode.parentElement,
    value = textNode.nodeValue,
    charCount = 0;

  // TODO: this attribute should be discrete not continuous
  parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(value) ? 1 : 0;
  parent.dotCount = countChar(value,'\u2022');
  parent.pipeCount = countChar(value,'|');
  charCount = value.length - value.split(/[\s\.]/g).length + 1;

  while(parent != root) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
}

function deriveAnchorFeatures(anchor) {
  var root = anchor.ownerDocument.body, parent = anchor.parentElement;
  if(anchor.charCount && anchor.hasAttribute('href')) {
    anchor.anchorCharCount = anchor.charCount;
    while(parent != root) {
      parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
      parent = parent.parentElement;
    }
  }
}

function deriveAttributeTextFeatures(element) {

  var text = ((element.getAttribute('id') || '') + ' ' +
    (element.getAttribute('class') || '')).trim().toLowerCase();

  if(text) {
    element.attributeText = text;
  }
}

/**
 * Apply our 'model' to an element. We generate a 'score' that is the
 * sum of several terms.
 */
function scoreElement(element) {

  var root = element.ownerDocument.body;

  element.score = element.score || 0;

  if(element.charCount && !element.matches(SELECTOR_LEAFY)) {
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

    var area = getImageArea(element);
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

  element.score += TAG_NAME_BIAS[element.localName] || 0;

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

  var ancestorBias = ANCESTOR_BIAS[element.localName];
  ancestorBias && each(element.getElementsByTagName('*'), function(childElement) {
    childElement.score = (childElement.score || 0) + ancestorBias;
  });

  var descendantBias = DESCENDANT_BIAS[element.localName];
  if(descendantBias && element.parentElement != root) {
    element.parentElement.score = (element.parentElement.score || 0) + descendantBias;
  }
}

/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 */
function getImageArea(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(isFinite(element.width) && isFinite(element.height)) {
    var area = element.width * element.height;

    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }
}

/**
 * Cache a count of siblings and a count of prior siblings as properties
 * of the element.
 *
 * TODO: see if there is a better way to get a node's own index in
 * the childNodes property of the parent without calculating it ourself.
 * Like getPositionInParent or something.
 */
function deriveSiblingFeatures(element) {
  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;
  if(element.siblingCount) {
    var sibling = element.previousElementSibling;
    while(sibling) {
      element.previousSiblingCount++;
      sibling = sibling.previousElementSibling;
    }
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

/**
 * Compares two elements and returns the element with the higher score.
 * The prior element is assumed to come first in document order.
 * If the two have equal scores the prior element is returned, based on the
 * notion that content is usually positioned earlier in a document.
 */
function getHigherScoringElement(previous, current) {
  return current.score > previous.score ? current : previous;
}

/**
 * Sets some html attributes based on some properties we stashed into
 * the native objects. Helpful for debugging.
 */
function exposeAttributes(element, options) {
  options.SHOW_BRANCH && element.branch && element.setAttribute('branch', element.branch);
  options.SHOW_ANCHOR_DENSITY && element.anchorDensity &&
    element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
  options.SHOW_CHAR_COUNT && element.charCount && element.setAttribute('charCount', element.charCount);
  options.SHOW_COPYRIGHT_COUNT && element.copyrightCount &&
    element.setAttribute('copyrightCount', element.copyrightCount);
  options.SHOW_DOT_COUNT && element.dotCount && element.setAttribute('dotCount', element.dotCount);
  options.SHOW_IMAGE_BRANCH && element.imageBranch && element.setAttribute('imageBranch', element.imageBranch);
  options.SHOW_PIPE_COUNT && element.pipeCount && element.setAttribute('pipeCount', element.pipeCount);
  options.SHOW_SCORE && element.score && element.setAttribute('score', element.score.toFixed(2));
}

/**
 * Remove an element if it is not visible according to isInvisibleElement
 */
function filterInvisibleElement(element) {
  // We have to check whether the element is defined because an ancestor of the element
  // may have been removed in a prior iteration, in the case of nested invisible elements,
  // and also because of iteration order, in that if this is called from getElementsByTagName,
  // then in document order, the parent element comes before the child element, meaning that
  // a hidden parent that is removed means the children should never be reached. But they
  // are reached, so we have to check.
  if(element && isInvisibleElement(element)) {
    element.remove();
  }
}

/**
 * Returns true if an element is invisible according to our own very
 * simplified definition of visibility. We are really only going after some
 * common tactics on the web that are used by article authors to hide
 * elements in articles, not a true visibility test. Many websites do things
 * like use display:none for DHTML effects, advertising, etc, that are likely
 * boilerplate.
 *
 * TODO: learn more about HTMLElement.hidden
 *
 * NOTE: this does not consider offscreen elements (e.g. left:-100%;right:-100%;)
 * as invisible.
 * NOTE: this does not consider dimensionless elements as invisible
 * (e.g. width:0px). Certain elements exhibit strange behaviors, like SPAN,
 * that report no width/height, even when the element contains non-empty
 * descendants and is therefore visible. We cannot do anything about the native
 * objects reporting 'incorrect' properties, so we cannot filter using this condition.
 * NOTE: this does not consider visibility of parents. Technically if parents are
 * invisible then this is visible.
 * NOTE: this does not consider if the element is in an overflow:none ancestor path and
 * happens to lay outside the visible rect
 * NOTE: this does not consider clipping.
 * NOTE: this does not consider scroll offset. In other words, the test is not about
 * whether the element is "currently" visible in this sense.
 * NOTE: this does not consider overlapping elements (e.g. higher z-index rectangle
 * that shares same coordinate space)
 * NOTE: this does not consider page visibility (e.g. in background tab)
 */
function isInvisibleElement(element) {
  return element.style.display == 'none' || element.style.visibility == 'hidden' ||
      parseInt(element.style.opacity) === 0;
}

/**
 * Remove a an image if it is 'one-dimensional'
 *
 * TODO: experiment with offsetWidth and offsetHeight
 */
function filter1DImage(element) {
  if(element && (element.width == 1 || element.height == 1)) {
    element.remove();
  }
}

/**
 * Removes removable attributes from the element
 *
 * NOTE: using filter avoids the issue with removing while iterating
 * over element.attributes, which is a live NodeList
 * NOTE: attribute.ownerElement is deprecated so we no way of referencing
 * the element unless we specify the forEach function here.
 * TODO: bind and use this.removeAttribute? Is binding bad perf?
 */
function filterElementAttributes(element) {

  var removeAttribute = function(attribute) {
    element.removeAttribute(attribute.name);
  };

  filter.call(element.attributes, isRemovableAttribute).forEach(removeAttribute);

  // NOTE: toying with binding. This function would be declared external
  // to this function, once.
  //function removeAttribute(attribute) {
  //  this.removeAttribute(attribute.name);
  //}

  // Then we bind the function here before passing to forEach
  //filter.call(element.attributes,
  //  isRemovableAttribute).forEach(removeAttribute.bind(element));

  // Wait, above is naive. Array.prototype.forEach has its
  // own bind parameter. So we would do this:
  //filter.call(element.attributes,
  //  isRemovableAttribute).forEach(removeAttribute, element);
}

/**
 * Returns true if an attribute is removable. Only
 * href and src are not removable.
 */
function isRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

/**
 * Replaces each occurrence of <br/> or <hr/> with <p></p>.
 * NOTES: this was never working correctly, under heavy construction
 */
function transformRuleElement(element) {

  // Test URL: http://balkin.blogspot.com/2014/06/hobby-lobby-part-xv-theres-no-employer.html
  // BUGGY

  // The behavior changes based on where the rule is located: whether it is
  // adjacent to text or inline elements or not, and whether it is within its own
  // blocking element
}

/**
 * Marks the current element as whitespaceImportant and then
 * marks all direct and indirect descendants as whiteSpaceImportant.
 *
 * Propagating this property from the top down (cascading) enables
 * the trimNode function to quickly determine whether its nodeValue
 * is trimmable, as opposed to having the trimNode function search each
 * text node's axis (path from root) for the presence of a
 * whitespaceImportant element.
 */
function cascadeWhitespaceImportant(element) {
  setWhitespaceImportant(element);
  each(element.getElementsByTagName('*'), setWhitespaceImportant);
}

/**
 * Set the whitespaceImportant flag on the native element object
 */
function setWhitespaceImportant(element) {
  element.whitespaceImportant = 1;
}


/**
 * Trims a text node. If the text node is sandwiched between
 * two inline elements, it is not trimmed. If the text node
 * only follows an inline element, it is right trimmed. If
 * the text node only precedes an inline element, it is left
 * trimmed. Otherwise, nodeValue is fully trimmed.
 *
 * Then, if nodeValue if falsy (undefined/empty string),
 * the node is removed.
 *
 * NOTE: instead of the side effect, maybe this function should
 * only trim, and a second function should remove. The problem
 * is that that requires two iterations.
 */
function trimAndMaybeRemoveTextNode(node) {
  if(!node.parentElement.whitespaceImportant) {
    if(isInlineElement(node.previousSibling)) {
      if(!isInlineElement(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInlineElement(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      // Going with native trim for now but a loop might be better.
      // http://blog.stevenlevithan.com/archives/faster-trim-javascript
      // http://jsperf.com/mega-trim-test
      node.nodeValue = node.nodeValue.trim();
    }

    if(!node.nodeValue) {
      node.remove();
    }
  }
}

/**
 * Returns true if the element is fertile (capable of having
 * child nodes) but childless (no child nodes found). Leaf
 * like elements (e.g. images) are never considered empty.
 *
 * TODO: is Node.hasChildNodes() clearer than element.firstChild?
 */
function isEmptyLikeElement(element) {
  return !element.firstChild && !element.matches(SELECTOR_LEAFY);
}

/**
 * Removes all empty-like elements from the document. If removing
 * an element would change the state of the element's parent to also
 * meet the empty-like criteria, then the parent is also removed, and
 * so forth, up the hierarchy, but stopping before doc.body.
 *
 * NOTE: it would be nice to be able to use the :empty pseudo-class
 * selector to enumerate the initial collection of empty-like elements,
 * but it turns out that the selector's behavior varies wildly and is
 * horribly documented and is not precisely the desired behavior. So
 * instead we use our own custom test for element emptiness. The performance
 * of non-native iteration might not matter, and may even be faster, and,
 * at least, it precisely aligns with the desired elements.
 *
 * TODO: removes should happen only once on the shallowest
 * parent. If this were called on a live doc we would be causing
 * several unecessary reflows. For example, in the case of
 * <div><p></p><p></p></div>, there are 3 remove operations,
 * when only 1 needed to occur. To do this, this function needs
 * to be fundamentally refactored. Removes should not occur
 * on the first pass over the elements. This, btw, would remove the
 * ugliness of using a map function with a side effet. Instead, start by
 * identifying all of the empty leaves. Then, for each leaf, traverse
 * upwards to find the actual element to remove. Be cautious
 * about simply checking that parent.childElementCount == 1 to find
 * a removable parent because it is false in the case that two
 * or more empty-leaves share the same parent. The criteria instead is
 * that a parent is removable if all of its children are removable.
 * So we need to go up 1, then query all direct children. But that is
 * kind of redundant since we already identified the children, so that
 * still might need improvement.
 */
function pruneEmptyElements(doc) {

  var root = doc.body, parent, grandParent,
    stack = filter.call(
      doc.body.getElementsByTagName('*'), isEmptyLikeElement).map(
        removeElementAndReturnParent);

  while(stack.length) {
    parent = stack.pop();
    if(!parent.firstChild) {
      grandParent = parent.parentElement;
      if(grandParent) {
        grandParent.removeChild(parent);
        if(grandParent != root)
          stack.push(grandParent);
      }
    }
  }
}

/**
 * Get the parent of the element with side effect of removing the element.
 * This function exists primarily because it is necessary to cache the
 * reference to parentElement before removing the element, because once an element
 * is removed it no longer has a parentElement, unless it was an ancestor of the
 * element that was actually removed. But we know we are directly removing the
 * element here and not  an ancestor, so caching the parentElement reference is
 * necessary.
 */
function removeElementAndReturnParent(element) {
  var parentElement = element.parentElement;
  parentElement.removeChild(element);
  return parentElement;
}

/**
 * Returns true if the node is a defined element that
 * is considered inline. Elements by default behave
 * according to either "display: block" or "display: inline". This can be changed
 * by CSS but we ignore that and use basic assumptions. In other words,
 * <p> is not inline and <span> is inline.
 *
 * Note: divs are technically inline, but are frequently used instead as blocks, so
 * divs are not considered inline.
 *
 * TODO: why are we checking if node is defined here?
 * TODO: why are we checking if node is an element? When is this ever called on
 * nodes and not elements?
 */
function isInlineElement(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && node.matches(SELECTOR_INLINE);
}

/**
 * Returns the frequency of ch in str.
 *
 * Note: http://jsperf.com/count-the-number-of-characters-in-a-string. This
 * uses a simple for loop instead of using str.split('|').length - 1
 * because performance is assumed to be better.
 */
function countChar(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }
  return count;
}

/**
 * A simple forEach for objects. This is useful for objects
 * like HTMLCollection oe NodeList that are returned by calls
 * to querySelectorAll or getElementsByTagName that do not provide a native
 * forEach method but support indexed array property access.
 */
function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len;
    func(obj[i++])) {
  }
}

/**
 * A simple helper to use forEach against traversal API.
 *
 * @param element - the root element, only nodes under the root are iterated. The
 * root element itself is not 'under' itself so it is not included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
function eachNode(element, type, func, filter) {
  var node, iterator = element.ownerDocument.createNodeIterator(element, type, filter);
  while(node = iterator.nextNode()) {
    func(node);
  }
}

/**
 * Removes the element but retains its children. Useful for
 * removing 'wrapper' style elements like span/div/form. This is like
 * element.remove() but we keep the children.
 *
 * TODO: element.replace(element.childNodes) ???
 * See http://dom.spec.whatwg.org/#childnode.
 * It looks like Chrome supports ChildNode.remove but
 * does not support replace/after/before.
 */
function unwrapElement(element) {
  // We have to check element is defined since this is called every iteration
  // and a prior iteration may have somehow removed the element.

  // We check if parent element is defined just in case this is somehow
  // called on an element that was removed (detached from the doc's DOM).
  // This function can work on detached nodes, but only if those nodes still have a
  // parentElement defined. The root element/node of a detached hierarchy does not
  // have a parentElement, but its children do have parents despite being deatched
  // from the main document.
  // NOTE: detachment can be tested easily, albeit poorly, by using
  // doc.body.contains(element).

  // NOTE: this function is not currently designed to perform well on
  // attached nodes, because it causes a reflow per move (per iteration
  // of the while loop below). It could be improved by moving the child
  // nodes into a DocumentFragment and then by replacing the original parent
  // with the fragment, which would cause fewer reflows. It could probably
  // be further improved by detaching the element itself first, then
  // building the fragment, and then inserting the fragment in the place
  // of the element (which means we need to store a reference to prev or
  // next sibling and also a reference to the parent element prior to
  // removing the element).
  // However, given that calamine is, for now, intended to run on a
  // non-live DOM, this improvement is not necessary.

  if(element && element.parentElement) {
    while(element.firstChild) {
      element.parentElement.insertBefore(element.firstChild, element);
    }

    element.remove();
    //element.parentElement.removeChild(element);
  }
}

/**
 * A simple helper for passing to iterators like forEach
 */
function removeNode(node) {
  //if(node && node.parentNode) {
  //  node.parentNode.removeChild(node);
  //}

  // Note: text nodes, comment nodes, and elements
  // all appear to support this more concise method.
  if(node) node.remove();
}

}());







/************************ SANITIZER FUNCTIONALITY ********************************
 * NOTE: broke apart sanitzer module into these functions
 * NOTE: might integrate with calamine functions
 */

function sanitizeAnchor(element) {


  var href = element.getAttribute('href');
  if(!href) {
    return unwrapElement(element);
  }

  // Scrub javascript urls
  if(/^javascript:/i.test(href)) {
    return unwrapElement(element);
  }

  // TODO: resolve

  // TODO: should be using a link handler to do this
  // this is a deprecated way of forcing new window. Also it
  // will be easier to make it a customizable preference if the
  // click handler can determine it later.
  node.setAttribute('target','_blank');
}

function sanitizeEmbed(element) {
  var src = node.getAttribute('src');
  if(src) {
    var srcURI = URI.parse(src.trim());

    // Rewrite youtube embeds to always use https so
    // as to comply with our CSP
    if(srcURI && srcURI.host && srcURI.scheme != 'https' &&
      srcURI.host.indexOf('www.youtube.com') == 0) {
      srcURI.scheme = 'https';

      node.setAttribute('src', URI.toString(srcURI));
    }
  }
}



// From sanitizer, needs refactoring
function resolveRelativeURLNode(node, base) {

  // No point in doing anything without a base uri
  if(!base) {
    return;
  }

  // TODO: maybe clean this up a bit to clarify which tags
  // use src and which use href. Maybe a function like
  // getURLAttributeForNode(node).
  var attributeName = node.matches('a') ? 'href' : 'src';
  var source = node.getAttribute(attributeName);

  // Cannot resolve nodes without an attribute containing a URL
  if(!source) {
    return;
  }

  var uri = parseURI(source);

  // Do not try and resolve absolute URLs
  if(uri.scheme) {
    return;
  }

  node.setAttribute(attributeName, resolveURI(base, uri));
}

// elements with resolvable attributes (href/src)
var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';

// TODO: add a not href
var SELECTOR_UNWRAPPABLE = 'article,center,details,div,font,help,insert,'+
  'label,nobr,noscript,section,span,st1';

// from sanitizer
var SELECTOR_BLACKLIST = 'base:1,basefont,command,datalist,dialog,'+
  'fieldset,frame,frameset,html,input,legend,link,math,meta,noframes,'+
  'option,optgroup,output,script,select,style,title,iframe';

var SELECTOR_WHITELIST = 'a,abbr,acronym,address,applet,'+
'area,article,aside,audio,b,base,basefont,bdi,bdo,big,'+
'br,blockquote,canvas,caption,center,cite,code,col,colgroup,'+
'command,data,datalist,details,dialog,dir,dd,del,dfn,div,'+
'dl,dt,em,embed,entry,fieldset,figcaption,figure,font,'+
'footer,frame,frameset,header,help,hgroup,hr,h1,h2,h3,'+
'h4,h5,h6,html,i,iframe,img,input,ins,insert,inset,'+
'label,legend,li,link,kbd,main,mark,map,math,meta,'+
'meter,nav,nobr,noframes,noscript,ol,object,option,'+
'optgroup,output,p,param,pre,progress,q,rp,rt,ruby,s,'+
'samp,script,section,select,small,span,strike,strong,style,'+
'st1,sub,summary,sup,vg,table,tbody,td,tfood,th,thead,time,'+
'title,tr,track,tt,u,ul,var,video,wbr';

// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
var BOOLEAN_ATTRIBUTES = {
  allowfullscreen:1,async:1,autofocus:1,autoplay:1,checked:1,compact:1,controls:1,
  declare:1,'default':1,defaultchecked:1,defaultmuted:1,defaultselected:1,
  defer:1,disable:1,draggable:1,enabled:1,formnovalidate:1,hidden:1,
  indeterminate:1,inert:1,ismap:1,itemscope:1,loop:1,multiple:1,muted:1,
  nohref:1,noresize:1,noshade:1,novalidate:1,nowrap:1,open:1,pauseonexit:1,
  readonly:1,required:1,reversed:1,scoped:1,seamless:1,selected:1,
  sortable:1,spellcheck:1,translate:1,truespeed:1,typemustmatch:1,
  visible:1
};

/**
 * Removes leading and trailing whitespace nodes from an HTMLDocument
 * The doc object itself is modified in place, no return value.
 * Note: we only traverse the first level of the DOM hiearchy
 */
function trimDocument(doc) {
  // Trim leading
  var node = doc.firstChild, sibling;
  while(node && isTrimmableNode(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }

  // Trim trailing
  node = doc.lastChild;
  while(node && isTrimmableNode(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
}

/**
 *  Returns true if the node is trimmable. Note
 * side effect it will trim text nodes (not quite right)
 */
function isTrimmableNode(node) {

  // Trim comments
  if(node.nodeType == Node.COMMENT_NODE) {
    return true;
  }

  // Trim empty text nodes.
  if(node.nodeType == Node.TEXT_NODE) {
    node.textContent = node.textContent.trim();
    if(node.textContent.length == 0) {
      return true;
    }
  }

  if(node.matches && node.matches('br')) {
    return true;
  }

  // Trim empty paragraphs.
  if(node.matches && node.matches('p')) {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.

    // TODO: consider &nbsp; and other whitespace entities. We are not at this
    // point sanitizing those. <p>&nbsp;</p> is a thing.

    // Note: consider childElementCount instead of childNodes.length. Although it might
    // be different here? Need to test the differences.

    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE &&
      node.firstChild.textContent.trim().length == 0) {
      // <p>whitespace</p>
      return true;
    }
  }
};





/*************** CONTENT FILTER FUNCTIONS ****************************
 * TODO: this should maintain its own state by saving
 * an array of rules in memory, instead of having caller
 * pass around a rules array.
 * TODO: comments
 * TODO: update dependencies
 */

function convertContentFilterToRegex(query) {
  // Escape regexp chars (except *) and then replace * with .*
  return query.replace(/[-[\]{}()+?.\\^$|#\s]/g,'\\$&').replace(/\*+/g,'.*');
}

function translateContentFilterRule(rule) {
  if(rule.match) {
    var pattern = convertContentFilterToRegex(rule.match);

    // Recreate the regular expression object as set as
    // the property 're'
    rule.re = new RegExp(pattern, 'i');
  }
}

function loadContentFilterRules() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  obj.rules.forEach(translateContentFilterRule);
  return obj.rules;
}

function saveContentFilterRules(rules) {
  localStorage.CONTENT_FILTERS = JSON.stringify({rules: rules || []});
}

function areContentFilterRulesEqual(rule1, rule2) {
  if(rule1.id && rule2.id)
    return rule1.id == rule2.id;
  return rule1.tag === rule2.tag && rule1.attr === rule2.attr &&
    rule1.match === rule2.match;
}

function getContentFilterRuleId(rule) {
  return rule.id;
}

function generateContentFilterId(rules) {
  var ids = rules.map(getContentFilterRuleId);
  var max = arrayMax(ids);
  return (!max || max < 1) ? 1 : (max + 1);
}

function createContentFilterRule(tag, attr, match) {
  var rules = loadContentFilterRules();

  var rule = {
    id: generateContentFilterId(rules),
    tag: tag,
    attr: attr,
    match: match
  };

  rules.push(rule);
  saveContentFilterRules(rules);
  return rule;
}

function removeContentFilterRule(ruleId) {
  var rules = loadContentFilterRules();
  var differentRuleId = function(rule) {
    return rule.id != ruleId;
  };

  var newRules = rules.filter(differentRuleId);
  saveContentFilterRules(newRules);
  return ruleId;
}

function contentFilterRuleToString(rule) {
  var s = '<';
  s += rule.tag ? rule.tag : 'any-tag';
  s += ' ';

  if(rule.attr) {
    s += rule.attr;
    if(rule.match) {
      s += '="' + rule.match + '"';
    }
  } else if(rule.match) {
    s += 'any-attribute="' + rule.match + '"'
  }

  s += rule.tag ? '></' + rule.tag + '>' : '/>';
  return s;
}



/**
 * NOTE: replaced evaluateRule in sanitizer
 */
function testContentFilterRuleMatchesNode(rule, node) {
  if(rule.tag && rule.re && rule.tag.toLowerCase() == node.localName.toLowerCase()) {
    var attr = node.getAttribute(rule.attr);
    if(attr) {
      return rule.re.test(attr);
    }
  }
}

/**
 * NOTE: returns true means keep, return false means remove it
 * TODO: refactor
 */
function applyContentFilterRulesToNode(node, rules) {

  if(!localStorage.ENABLE_CONTENT_FILTERS) {
    return 1;
  }

  var matched = any(rules, function(rule) {
    return testContentFilterRuleMatchesNode(rule, node);
  });

  // 0 = remove, 1 = retain
  return matched ? 0 : 1;
}