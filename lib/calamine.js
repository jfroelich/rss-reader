/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 */
var calamine = (function(exports, each, filter, map) {
'use strict';

// TODO: these should be default options, and transformDocument
// should have an options parameter.
var options = {
  HIGHLIGHT_MAX_ELEMENT: 1,
  SHOW_CARDINALITY: 0,
  SHOW_CHAR_COUNT: 0,
  SHOW_SCORE: 0,
  SHOW_TEXT_DENSITY: 0
};

/**
 * Apply calamine to an HTMLDocument object. Returns the best
 * element to use as the source of the new document.
 * 
 * The current implementation focuses on accuracy and concise code
 * over performance. Preliminary testing shows that even with several
 * hundred redundant calls to getElementsByTagName, and several 
 * redundant loops, it is still fast enough.
 *
 * TODO: return a new clean DOM object. This will allow us to 
 * merge multiple best elements into a single DOM in document order
 * and return that instead. This will also help with the proximate
 * elements issues. This will also allow us to filter wrapper
 * elements.
 * TODO: re-introduce support for iframes. This is probably as 
 * difficult as image scoring?
 */
function transformDocument(doc) {

  filterUndesirableElements(doc);
  transformRuleElements(doc);
  deriveElementAttributeFeatures(doc);
  filterEmptyElements(doc);
  filterCommentNodes(doc);
  deriveCardinality(doc);
  deriveImageFeatures(doc);
  deriveTextFeatures(doc);
  deriveAnchorFeatures(doc);
  applyModel(doc);

  var bestElement = findBestElement(doc);

  // TODO: What if best is wrapper?
  //filterWrapperElements(doc);

  filterElementAttributes(doc);

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';  
    }
  }

  if(options.SHOW_SCORE) {
    exposeScoreAttribute(doc);
  }

  return bestElement;
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
  'noscript',
  'script',
  'select',
  'style'
];

var BAD_TAG_SELECTOR = BAD_TAG.join(',');

/**
 * Removes elements in BAD_TAG from the dom.
 */
function filterUndesirableElements(doc) {
  each(doc.querySelectorAll(BAD_TAG_SELECTOR), removeElement);  
}

/**
 * TODO: now that we filter attributes later, instead of during 
 * preprocessing, this is largely unecessary. The attribute bias 
 * function can directly access the attribute. Refactor that, and
 * then deprecate this.
 */
function deriveElementAttributeFeatures(doc) {
  each(gebn(doc), function(element) {
    var id = element.getAttribute('id');
    var clz = element.getAttribute('class');

    if(id) {
      element.rawId = id;
    }

    if(clz) {
      element.rawClass = clz;
    }
  });
}

/**
 * Removes all attributes from each element in the document except for 
 * href and src.
 */
function filterElementAttributes(doc) {
  // NOTE: if attribute.parentNode is element we shold be using that
  // so we can avoid an unecessary closure ref
  each(gebn(doc), function(element) {
    filter(element.attributes, function(attribute) {
      return attribute.name != 'href' && attribute.name != 'src';
    }).forEach(function(attribute) {
      element.removeAttributeNode(attribute);
    });
  });
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
function transformRuleElements(doc) { 
  each(doc.querySelectorAll('hr,br'), function(element) {

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
  });
}

/**
 * Filter out all 'empty' elements. See isEmptyElement.
 */
function filterEmptyElements(doc) {
  filter(gebn(doc), isEmptyElement).forEach(removeElement);
}

/**
 * Filter out <!-- comments -->
 */
function filterCommentNodes(doc) {
  var comment, commentIt = doc.createNodeIterator(doc,NodeFilter.SHOW_COMMENT);
  while(comment = commentIt.nextNode()) {
    comment.parentNode.removeChild(comment);
  }  
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
function deriveCardinality(doc) {
  each(gebn(doc.body), function(element) {
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
  });
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
function deriveImageFeatures(doc) {
  var root = doc.body;
  each(root.getElementsByTagName('img'), function(image) {
    if(!image.hasAttribute('src')) return;
    var parentElement = image.parentElement;
    while(parentElement != root) {
      parentElement.imageCount = parentElement.imageCount ?
        parentElement.imageCount + 1 : 1;
      parentElement = parentElement.parentElement;
    }
  });  
}

/**
 * Extracts text features
 * 
 * TODO: experiment with subtracting value.split(/[\s\.]/g).length
 * For better performance, combine the calculation with the trim op.
 */
function deriveTextFeatures(doc) {
  var root = doc.body;

  // Propagate text metrics
  var textNode, textIterator = doc.createNodeIterator(root, NodeFilter.SHOW_TEXT);
  var value, charCount;
  while(textNode = textIterator.nextNode()) {
    // nodeValue is guaranteed defined for a textNode
    value = textNode.nodeValue.trim();

    // Many text nodes are whitespace. Rather than 
    // pruning, we simply ignore them. Pruning would help slightly for 
    // compression purposes but not here.
    if(!value) continue;

    charCount = value.length;

    // Rather than calling textContent on every element, we use an 
    // agglomerative bottom-up approach that accumulates charCount
    // in the hierarchy. I am assuming this is more performant.

    var parentElement = textNode.parentElement;
    while(parentElement != root) {
      parentElement.charCount = parentElement.charCount ?
        parentElement.charCount + charCount : charCount;
      
      // TODO: move this out of here and put somewhere else
      // it gets called redundantly anyway.
      if(options.SHOW_CHAR_COUNT) {
        parentElement.setAttribute('charCount', parentElement.charCount);
      }

      parentElement = parentElement.parentElement;
    }

    // Look for copyright characters
    // TODO: look for other non-token characters like pipes
    if(/[©]|&copy;|&#169;/i.test(value)) {
      parentElement.copyrightCount = 1;
    }
  }
}

/**
 * Propagate anchor metrics
 *
 * Anchor character length is used by the anchor density metric.
 * This assumes that the charCount property was previously set.
 */
function deriveAnchorFeatures(doc) {
  var root = doc.body;

  each(root.getElementsByTagName('a'), function(anchor) {
    var chars = anchor.charCount;
    if(!chars) return;

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
    
    anchor.anchorCharCount = chars;

    // Like deriveTextFeatures, we accumulate the feature
    // per element from the leaves of the hierarchy up to its 
    // root (excluding root), in an agglomerative fashion. We do this
    // because it is assumed to be better performance than a top down
    // approach.

    var parentElement = anchor.parentElement;
    while(parentElement != root) {
      parentElement.anchorCharCount = parentElement.anchorCharCount ?
        parentElement.anchorCharCount + chars : chars;
      parentElement = parentElement.parentElement;
    }
  });  
}

/**
 * Set a 'score' atribute, rounded to two digits.
 */
function exposeScoreAttribute(doc) {
  each(gebn(doc.body), function(element) {
    element.setAttribute('score', element.score.toFixed(2));
  });
}

/**
 * Applies the classifier-like model to every element.
 */
function applyModel(doc) {
  each(gebn(doc.body), scoreElement);

  // This must be called in a second iteration because it requires
  // that sibling element scores have settled.
  each(gebn(doc.body), applySiblingBias);
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
 * Searches for the best element in the document according to its
 * score and returns the element. Falls back to the document
 * object if a good enough cannot be found.
 */
function findBestElement(doc) {
  
  // TODO: improve handling of proximate boilerplate and content

  var maxElement, maxScore = 0;
  each(gebn(doc.body), function(element) {
    if(element.score > maxScore) {
      maxScore = element.score;
      maxElement = element;
    }
  });

  if(!maxElement) {
    maxElement = doc;
  }

  return maxElement;
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

function filterWrapperElements(doc) {
  //each(doc.querySelectorAll('div,span'), unwrapElement);
  //each(doc.querySelectorAll('span'), unwrapElement);

  // Unwrap form (instead of removing it during preprocessing).
  //each(doc.querySelectorAll('form'), unwrapElement);
}

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

}(this, util.each, util.filter,util.map)); 