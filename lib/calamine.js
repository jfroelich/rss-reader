/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 */
var calamine = (function(exports, each) {
'use strict';

// TODO: these should be default options, and transformDocument
// should have an options parameter.
var options = {
  HIGHLIGHT_MAX_ELEMENT: 1,
  SHOW_CARDINALITY: 0,
  SHOW_CHAR_COUNT: 0,
  SHOW_SCORE: 0,
  SHOW_TEXT_DENSITY: 0,
  UNWRAP_NOSCRIPT: 1
};

/**
 * Apply calamine to an HTMLDocument object. Returns the best
 * element to use as the source of the new document.
 * 
 * The current implementation focuses on accuracy and clear code
 * over performance. Preliminary testing shows reasonable performance 
 * even with massively redundant iteration.
 *
 * TODO: return a new clean DOM object. This will allow us to 
 * merge multiple best elements into a single DOM in document order
 * and return that instead. This will also help with the proximate
 * elements issues. This will also allow us to filter wrapper
 * elements without doing any work because we simply walk past them
 * NOTE: review appendChild's behavior when transfering document context.
 * NOTE: would using cloneNode avoid the appendChild issue?
 * TODO: re-introduce support for iframes. This is probably as 
 * difficult as image scoring?
 */
function transformDocument(doc) {

  // TODO: there is no point to doing this if we create return a new DOM
  // Filter out undesirable elements
  each(doc.body.querySelectorAll(BAD_TAG_SELECTOR), removeElement);

  // TODO: there is no point to doing this if we create a new DOM
  // Filter out comment nodes for compression and easier debugging
  var commentNode, 
      commentIt = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
  while(commentNode = commentIt.nextNode()) {
    commentNode.parentNode.removeChild(commentNode);
  }

  // Special noscript handling for anti-scraping techniques
  // TODO: there is no point to doing this if we create a new DOM
  if(options.UNWRAP_NOSCRIPT) {
    each(doc.body.querySelectorAll('noscript'), unwrapElement);  
  }

  // Replace rules with paragraphs
  each(doc.body.querySelectorAll('hr,br'), transformRuleElement);

  // Cache attribute properties
  // TODO: now that we filter atts later, deprecate this
  // after modifying attribute density function
  each(doc.body.getElementsByTagName('*'), deriveElementAttributeFeatures);

  // TODO: there is no point to doing this if we create a new DOM
  // Filter out empty elements
  Array.prototype.filter.call(
    doc.body.getElementsByTagName('*'), isEmptyElement
  ).forEach(removeElement);
 
  // Pre-calculate cardinality for text density metric
  each(doc.body.getElementsByTagName('*'), deriveCardinality);

  // Extract and store image features
  each(doc.body.getElementsByTagName('img'), deriveImageFeatures);

  // Derive text features
  var textNode, 
    textIterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  while(textNode = textIterator.nextNode()) {
    deriveTextFeatures(textNode);
  }

  // Derive anchor features
  each(doc.body.getElementsByTagName('a'), deriveAnchorFeatures);

  // Apply the model (pass 1)
  each(doc.body.getElementsByTagName('*'), scoreElement);

  // Apply the model (pass 2)
  each(doc.body.getElementsByTagName('*'), applySiblingBias);

  // Filter element attributes
  // Still need to do this even if we switch to returning a new DOM.
  each(doc.body.getElementsByTagName('*'), filterElementAttributes);

  // Find the highest scoring element
  // TODO: include proximate content, exclude certain nested boilerplate
  // TODO: look into https://developer.mozilla.org/en-US/docs/Web/API/range for 
  // proximate distance (commonAncestor)?
  doc.body.score = -Infinity;
  var bestElement = Array.prototype.reduce.call(
    doc.body.getElementsByTagName('*'), getHigherScoringElement, doc.body);

  // TODO: What if best is a wrapper? We cannot unwrap here
  // in a simple way.
  // TODO: there is no point to doing this if we return a new DOM
  // TODO: qsa or gebtn?
  //each(doc.body.querySelectorAll('div,form,span'), unwrapElement);

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';  
    }
  }

  if(options.SHOW_SCORE) {
    each(doc.body.getElementsByTagName('*'), setScoreAttribute);
  }

  if(options.SHOW_CHAR_COUNT) {
    each(doc.body.getElementsByTagName('*'), setCharCountAttribute);
  }

  // Clean up after ourselves? (from doc, we may set props in doc.body)
  each(doc.getElementsByTagName('*'), cleanNonNativeProperties);

  return bestElement;
}

/**
 * Compares two elements and returns the element with the higher score.
 * The prior element is assumed to come first in document order. 
 * If the two have equal scores the prior element is returned.
 */
function getHigherScoringElement(previous, current) {
  return current.score >= previous.score ? current : previous;
}

function cleanNonNativeProperties(element) {
  // TODO: make sure this is exhaustive
  delete element.anchorCharCount;
  delete element.charCount;
  delete element.cardinality;

  // NOTE: if rawId and rawClass get deprecated do not forget to 
  // remove them here
  delete element.rawId;
  delete element.rawClass;
  delete element.score;
}

function setCharCountAttribute(element) {
  element.setAttribute('charCount', element.charCount);
}

function setScoreAttribute(element) {
  element.setAttribute('score', element.score.toFixed(2));
}

// NOTE: this is incomplete, see sanitizer for the proper list.
// NOTE: do NOT remove 'form'. Some pages embed content in <form>.
var BAD_TAG = [
  'applet',
  'button',
  'embed',
  'frame',
  'frameset',
  'head',
  'iframe',
  'input',
  'object',
  'option',
  'script',
  'select',
  'style'
];

var BAD_TAG_SELECTOR = BAD_TAG.join(',');


/**
 * TODO: now that we filter attributes later, instead of during 
 * preprocessing, this is largely unecessary. The attribute bias 
 * function can directly access the attribute. Refactor that, and
 * then deprecate this.
 */
function deriveElementAttributeFeatures(element) {

  var id = element.getAttribute('id');
  var clz = element.getAttribute('class');

  if(id) {
    element.rawId = id;
  }

  if(clz) {
    element.rawClass = clz;
  }

}

/**
 * Removes attributes that should not appear in the output from 
 * the element.
 */
function filterElementAttributes(element) {
  // NOTE: if attribute.parentNode is a thing we shold be using that
  // so we can avoid an unnecessary closure ref and move this function
  // out of here so we are not creating it every time. Or maybe 
  // use bind.

  var removeAttributeNode = function(attribute) {
    element.removeAttributeNode(attribute);
  };

  // Filtering into a new array avoids the issue of removing 
  // things from a live collection while iterating.
  Array.prototype.filter.call(element.attributes, isRemovableAttribute).forEach(
    removeAttributeNode);
}

function isRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}


/**
 * Replaces each occurrence of <br/> or <hr/> with <p></p>.
 *
 * This is done so that we properly analyze text blocks. Since 
 * we operate at the block level (well, in the older version we did),
 * we want to avoid mischaractering separate blocks. This is partly 
 * based on the idea that sometimes text is visually separable on the screen
 * but not so inside the dom. We want to more accurately reflect what
 * someone sees on the screen rather than how the dom hierarchy happened
 * to structure the data.
 *
 * Research: according to the VIPs paper, HR and BR should not be treated
 * equally. HR is a better indicator of a complete visual division of 
 * content, where as BR is only an indicator of a split in block content.
 */
function transformRuleElement(element) { 
  var doc = element.ownerDocument;
  // Transfer parent attributes to the new paragraph
  // so that it can be properly scored (attribute bias)
  var parent = element.parentNode;
  var p = doc.createElement('p');
  var id = parent.getAttribute('id');
  var clz = parent.getAttribute('class');
  
  if(id) {
    p.setAttribute('id', id);
  }

  if(clz) {
    p.setAttribute('class', clz);
  }

  parent.replaceChild(p, element);
}


/**
 * Calculate cardinality. Cardinality represents a count of all descendants of 
 * an element. The DOM does not offer a simple way to get all children. 
 * node.childNodes and element.childElements only access immediate descendants.
 *
 * Cardinality is more abstract than that, however. It represents the denominator
 * in the text density heuristic. Therefore, it can be dampened. Dampening cardinality 
 * (reducing the size of the denominator in the text density metric) is necessary to 
 * avoid some common pitfalls, such as a table of several hundred cells being embedded 
 * inside an element that also contains the best content. This unfairly penalizes 
 * the parent element's density; increasing classification error.
 */

function deriveCardinality(element) {

  var cardinality = gebn(element).length;
  var originalCardinality = cardinality;

  if(cardinality) {

    element.cardinality = cardinality;

    // Greatly dampen cardinality of table rows
    var tableRowCardinality = element.getElementsByTagName('tr').length;
    if(tableRowCardinality) {

      element.cardinality -= tableRowCardinality;
      element.cardinality += 0.01 * tableRowCardinality;

      // Greatly dampen cardinality of table cells
      var tableCellCardinality = element.getElementsByTagName('td').length;
      if(tableCellCardinality) {
        element.cardinality -= tableCellCardinality;
        element.cardinality += 0.01 * tableCellCardinality;
      }
    }

    // Dampen cardinality of paragraphs so that we inflate text density
    var paragraphCardinality = element.getElementsByTagName('p').length;
    if(paragraphCardinality) {
      element.cardinality -= paragraphCardinality;
      element.cardinality += 0.2 * paragraphCardinality;
    }

    // TODO: dampen other 'content' containers like b,i,embed,strong,span


    if(options.SHOW_CARDINALITY) {
      element.setAttribute('cardinality', element.cardinality || 0);
      element.setAttribute('originalCardinality', originalCardinality || 0);
    }
  }
}

/**
 * Propagate image metrics
 * TODO: use diff weights for image dimensions? the larger the 
 * area, the larger the score, because the image takes up 
 * more space on the screen, and is therefore more likely to be 
 * related to content. e.g. infographics stuff.
 * I think what we want is this. imageArea property. If width and 
 * height are accessible from attributes or style, calculate area
 * and store that. if not accessible assume 100x100 or something.
 * then, instead of propagating image count, propagate image area.
 * this is more visual and differentiates images from one another,
 * and in the worst case of implicit dimensions (which we cannot 
 * get because this is all prerender in a detached content)
 * every image is treated the same by using the default area.
 * NOTE: clamp area to 800x600.
 * NOTE: penalize 1x1 (matches signature of hidden image tracking)
 * Also: another obvious image weighting technique is alt/title text.
 */

function deriveImageFeatures(image) {
  if(!image.hasAttribute('src')) return;
  var root = image.ownerDocument.body;
  var parentElement = image.parentElement;
  while(parentElement != root) {
    parentElement.imageCount = parentElement.imageCount ?
      parentElement.imageCount + 1 : 1;
    parentElement = parentElement.parentElement;
  }
}

/**
 * Extracts text features
 * 
 * Rather than calling textContent on every element, we use an 
 * agglomerative bottom-up approach that accumulates charCount
 * in the hierarchy. I am assuming this is more performant.
 *
 * TODO: experiment with subtracting value.split(/[\s\.]/g).length
 * For better performance, combine the calculation with the trim op.
 */
function deriveTextFeatures(textNode) {

  var rootElement = textNode.ownerDocument.body,
    value = textNode.nodeValue.trim(), 
    charCount = 0, parentElement;

  if(!value) return;

  charCount = value.length;

  parentElement = textNode.parentElement;
  while(parentElement != rootElement) {
    parentElement.charCount = parentElement.charCount ?
      parentElement.charCount + charCount : charCount;
    parentElement = parentElement.parentElement;
  }

  // Look for copyright characters
  // TODO: look for other non-token characters like pipes
  if(/[©]|&copy;|&#169;/i.test(value)) {
    parentElement.copyrightCount = 1;
  }
}

/**
 * Propagate anchor metrics
 *
 * Anchor character length is used by the anchor density metric.
 * This assumes that the charCount property was previously set.
 */


function deriveAnchorFeatures(anchor) {
  var root = anchor.ownerDocument.body, parentElement;

  if(!anchor.charCount) return;

  // Anchor density should not be affected by anchor elements
  // that do not have an href attribute. Anchors can be used 
  // like other inline elements such as span/div/em/strong, so we 
  // want to differentiate between a 'formatting' anchor, an 
  // anchor with just a name attribute (a 'placeholder' anchor for 
  // URL hash tactics), and an actual hypertext link to another
  // web page. Only links to other web pages should influence
  // anchor density, because only links to other web pages 
  // help determine whether an element is boilerplate.
  if(!anchor.hasAttribute('href')) return;
  
  anchor.anchorCharCount = anchor.charCount;

  // Like deriveTextFeatures, we accumulate the feature
  // per element from the leaves of the hierarchy up to its 
  // root (excluding root), in an agglomerative fashion. We do this
  // because it is assumed to be better performance than a top down
  // approach. This is analogous to event bubbling.
  parentElement = anchor.parentElement;
  while(parentElement != root) {
    parentElement.anchorCharCount = parentElement.anchorCharCount ?
      parentElement.anchorCharCount + anchor.charCount : anchor.charCount;
    parentElement = parentElement.parentElement;
  }
}


/**
 * Apply our 'model' to an element. This is similar to a simple 
 * regression model. We generate a 'score' that is the sum of several
 * terms from the right hand side of a basic formula.
 */
function scoreElement(element) {
  // Ensure our left hand side is defined
  element.score = element.score || 0;

  // Apply each term individually in succession. Order does not 
  // matter.
  element.score += getAnchorDensityBias(element);
  element.score += getTextDensityBias(element);
  element.score += getDescendantDiversityBias(element);
  element.score += getCopyrightBias(element);
  element.score += getPositionBias(element);
  element.score += getTagNameBias(element);
  element.score += getAttributeBias(element);
  element.score += getStyleBias(element);

  // Rather than keep a 'path' or 'axis' per element and score
  // based on whether the element is within the path of certain 
  // parent elements from the root, we just apply downward and 
  // upward score changes here while we are at the element. This is
  // assumed to be faster than having to do several 
  // isThisElementDirectlyOrIndirectlyUnderThatElement
  // calls. This is basically is 'under path' term.

  // Bias all of the descendants of certain ancestor elements
  var ancestorBias = ANCESTOR_BIAS[element.localName];
  if(isFinite(ancestorBias)) {
    each(gebn(element), function(childElement) {
      childElement.score = childElement.score || 0;
      childElement.score += ancestorBias;
    });
  }

  // This is basically an 'over path' term, but is limited to 
  // direct ancestors. It is limited to one edge traversal because it 
  // it can super-inflate connected vertices, which is not 
  // desirable.

  // Bias the immediate ancestor of certain descendant elements
  var descendantBias = DESCENDANT_BIAS[element.localName];
  if(isFinite(descendantBias)) {
    var parentElement = element.parentElement;
    var rootElement = element.ownerDocument.body;
    if(parentElement != rootElement) {
      parentElement.score = parentElement.score || 0;
      parentElement.score += descendantBias;
    }
  }
}

/**
 * Calculates and returns the anchor density term, including
 * its coefficient, which is then arbitrarily set to 
 * +- 100 (which by the way is a clue it might need to be 
 * refactored in the future).
 *
 * Anchor density is on a scale of 0 to 1, where 1 represents
 * high density, and therefore probably boilerplate. The closer 
 * to 0, the more likely it is content.
 * 
 * According to the "Boilerplate Detection using Shallow Text Features"
 * paper, a density greater than 0.35 is generally boilerplate.
 *
 * This approach uses an even shallower definition of anchor density.
 * It turns out there is no real need to differentiate between words to 
 * get a reliable metric. We can just look at character length. In a 
 * more constrained environment where we did not have hierarhical clues
 * then we would probably care more about using deeper NLP metrics like 
 * word count or average word length. What I found is that the ratio 
 * of the characters in anchor text to the text under the node reasonably
 * approximates the ratio of the number of words in anchor text to the number
 * of words in the element's text.
 * 
 * Using character count instead of word count is assumed to be more performant.
 * However, there are some incredibly fast ways to do word counting when we 
 * do not care about word semantics but merely the presence of non-word-character 
 * characters like whitespace. See older GIT versions for an example.
 */
function getAnchorDensityBias(element) {

  var score = 0;
  if(element.anchorCharCount && element.charCount) {
    var anchorDensity = element.anchorCharCount / element.charCount;
    if(anchorDensity > 0.35) {
      score -= 100;
    } else {
      score += 100;
    }
  }

  return score;
}

/**
 * Text density is a measure of the ratio of characters in the element's text 
 * to the element's cardinality. This is defined slightly differently than
 * text density in some of the research.
 *
 * To deal with low cardinality unduly yielding high text density, we use a 
 * decision-tree like approach (a couple of hand-crafted nested if statements)
 * to avoid the undesirable effect.
 *
 * Generally, a higher text density suggests a higher chance that the element
 * contains desirable content.
 */
function getTextDensityBias(element) {
  var score = 0;

  if(element.localName == 'img') {
    return score;
  }

  if(!element.charCount) {
    return score;
  }

  var textDensity = 0;

  if(element.cardinality && element.cardinality > 3) {
    
    // Normal desirable cardinality influence/behavior
    textDensity = (element.charCount || 0) / element.cardinality;

    if(textDensity > 20) {
      // Extremely high chance of content
      score += 200;
    } else if(textDensity > 10.5) {
      // High chance of content
      score += 100;
    } else if(textDensity > 7) {
      // Questionable
      score += 20;
    } else {
      // Boilerplate
      score -= 100;
    }
  } else if(element.cardinality && element.cardinality > 1) {
    // Less normal cardinality behavior
    textDensity = element.charCount / 10;
    // Questionable chance of content
    score += 20;
  } else {
    // Paranormal cardinality behavior. Cardinality may be 
    // undefined or 0.

    // This issue dealt with by this branch similar to the issue
    // surrounding 'text less than a single line in length' that 
    // is discussed in the paper
    textDensity = element.charCount / 10;

    // Very small chance of content
    score += 10;
  }

  // TODO: this should moved somewhere else
  if(options.SHOW_TEXT_DENSITY) {
    element.setAttribute('textDensity', textDensity);
  }

  return score;  
}

/**
 * Expiremental. The idea is that elements that contain a 
 * large number of distinct types of child elements (immediate
 * or not immediate?) are more or less likely to be content.
 *
 * Based on a small mention in the VIPS paper.
 *
 * Not yet implemented.
 */
function getDescendantDiversityBias(element) {
  return 0;
}

/**
 * Copyright bias. Experimental.Consider abstracting this a bit to 
 * count|non-text|symbols|that|frequently|appear|in|boilerplate.
 */
function getCopyrightBias(element) {
  var score = 0;
  if(element.copyrightCount) {
    score -= 10;
  }
  return score;
}

/**
 * Position bias. Elements closer to the top or middle are gently promoted.
 * This only considers same-depth same-parent elements (siblings) in the 
 * dom. Given that the dataset to be scored is a hierarchy and not a normal
 * flat table, it is hard to judge precisely 'where' a block is visually 
 * located when iterating elements in a hierarchy 'in document order'.
 *
 * Technically, document order can be completely unrelated to layout. Especially
 * because of the trend towards CSS formatting and away from HTML formatting.
 * And because the semantic web does not really exist at this point, and 
 * as evidenced by the failure of XHTML. We cannot even really rely on authors
 * to use formal techniques. We have to react and assume the input is dirty.
 *
 * We are dealing with absolutely positioned divs and so forth. However, CSS
 * is an external resource that is generally not available to us, and is not 
 * entirely clear how useful style information would be, or how useful it would 
 * be to recreate the page's actual visual layout, or how much processing 
 * it would require to do hundreds of calls to get bounds of elements and 
 * measuring font sizes and basically recreate the entire functionality of a 
 * browser. So we just approximate and hope for the best.
 *
 * See VIPS: A Vision-based Page Segmentation Algorithm.
 * http://research.microsoft.com/pubs/70027/tr-2003-79.pdf
 */
function getPositionBias(element) {

  var siblingCount = element.parentElement.childElementCount - 1, score = 0, 
    previousSiblingCount = 0, sibling, startOffsetBias, 
    halfSiblingCount, midOffsetBias;

  if(!siblingCount) return score;

  sibling = element.previousElementSibling;
  while(sibling) {
    previousSiblingCount++;
    sibling = sibling.previousElementSibling;
  }

  startOffsetBias = 2 - 2 * previousSiblingCount / siblingCount;
  score += startOffsetBias;
  halfSiblingCount = siblingCount / 2;
  midOffsetBias = 2 - 2 * (Math.abs(previousSiblingCount - halfSiblingCount) / halfSiblingCount);
  score += midOffsetBias;
  return score;
}

/**
 * A simple heuristic that increases or decreases the score
 * based on the name of the tag.
 */
function getTagNameBias(element) {
  // Bias certain elements
  var score = 0;
  var tagNameBias = TAG_NAME_BIAS[element.localName];
  if(isFinite(tagNameBias)) {
    score += tagNameBias;
  }
  return score;
}

/**
 * Bias lookup table for getTagNameBias
 */
var TAG_NAME_BIAS = {
  a:-1, address:-3, article:30, blockquote:3, button:-100, dd:-3,
  div:5, dl:-10, dt:-3, footer:-20, font:0, form: -3, header: -5,
  h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -10, nav: -50,
  ol:-20, p:10, pre:3, section:10, td:3, time:0, tr:1, th:-3, ul:-20
};

/**
 * Bias by id or class attribute value. Many websites use templates
 * (e.g. blog platforms) that consistently use certain named classes
 * or element ids, regardless of domain/language. These also provide
 * a hint about the likelihood an element contains desirable content
 * or boilerplate.
 */
function getAttributeBias(element) {

  var attributeText = ((element.rawId || '') + ' ' + (element.rawClass || '')).trim();
  var score = 0;
  if(attributeText) {
    if(RE_POSITIVE_CLASS.test(attributeText)) {
      score += 25;
    } else if(RE_NEGATIVE_CLASS.test(attributeText)) {
      score -= 25;
    }
  }
  return score;
}

/**
 * Elements with these words anywhere in ID or CLASS
 * attribute are promoted
 */
var POSITIVE_CLASS_TOKEN = [
 'article','author','body','byline',
 'attachment','content','carousel',

 // Pre image weighting attempt at getting xkcd to work
 'comic',

 'entry','main','post','text','blog','story'];

 /**
  * Elements with these words anywhere in ID or CLASS
  * are penalized
  */
var NEGATIVE_CLASS_TOKEN = [
  'about','ad-','ads','advert','branding','button','comment',
  'component','contact','facebook','foot','footer','footnote',
  'google','header','insta','left','linkedin','links','logo',
  'mainNav','menu','navbar','parse','powered','promo','recap',
  'related','right','scroll','share','shoutbox','sidebar',
  'social','sponsor','shopping','tags','tool','twitter','week',
  'widget','zone'];
var RE_POSITIVE_CLASS = new RegExp(POSITIVE_CLASS_TOKEN.join('|'),'i');
var RE_NEGATIVE_CLASS = new RegExp(NEGATIVE_CLASS_TOKEN.join('|'),'i');


/**
 * Experimental, not yet implemented.
 *
 * Per VIPs and my own thoughts
 * - opacity
 * - css visibility
 * - css display
 * - background color = foreground color
 * - background color contrast to bgcolor of all parents in path to root
 * - weak difference between background and foregrond
 * - relative font size
 * - dimensions (bounds rect)
 * - degree of perceived overlap with all other elements
 * - whether completely overlapped
 * - element background image, page background image
 * - background image color histogram (grossssss)
 * - intra-element distance (margins/padding)
 * - onload page visibility (whether text shows up)
 * - offsets (general location)
 *
 * I am not sure this will ever be implemented
 */
function getStyleBias(element) {
  return 0;
}

/**
 * Propagate scores to nearby siblings. Look up to 2 elements 
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their 
 * context.
 */
function applySiblingBias(element) {
  var elementBias = element.score > 0 ? 3 : -3;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    }
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      }
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    }
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      }
    }
  }
}



/**
 * These elements generally represent content that should signify 
 * that the containing element is a content container. Reward all
 * ancestors for containing these elements.
 */
var DESCENDANT_BIAS = {
  p:3, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
  sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
  strong:1, b:1
};

/**
 * These elements punish all descendant element scores. For example,
 * any number of elements/text nodes/anything underneath a NAV
 * element is extremely likely to be boilerplate. This is based on the 
 * assumption the page author is not misusing the intended semantics.
 */
var ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10
};


/**
 * An alias for element.getElementsByTagName('*')
 */
function gebn(element) {
  return element.getElementsByTagName('*');
}

/**
 * Returns true if an element is 'empty' in the sense that 
 * it should be ignored or pruned/removed from the document.
 *
 */
function isEmptyElement(element) {
  
  // Carve out an exception for images.
  if(element.localName == 'img') {
    return 0;
  }

  var childNodeCount = element.childNodes.length;

  // Note: the following still does not behave exactly as desired
  // when there are multiple child text nodes.

  if(childNodeCount == 1 && element.firstChild.nodeType == Node.TEXT_NODE) {
    // If there is one child text node, then 
    // we know there are no further descendants. 
    // Return true if it has no length after trimming.
    return  !element.firstChild.nodeValue.trim().length;
  } 

  return !childNodeCount;
}

/**
 * Removes the element but retains its children. Useful for 
 * removing 'wrapper' style elements like span/div/form
 */
function unwrapElement(element) {
  while(element.firstChild) {
    element.parentNode.insertBefore(element.firstChild, element);
  }

  element.parentNode.removeChild(element);  
}

/**
 * Straightforward remove element. It is a function so it 
 * be passed as a callback to things like [].forEach
 */
function removeElement(element) {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * The public API
 */
return {
  transform: transformDocument,
  options: options
};

}(this, util.each)); 