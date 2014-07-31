// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.score = function(doc) {

  // Expects this instanceof lucu.calamine

  var elements = doc.body.getElementsByTagName('*');

  // We have to explicitly bind this for some reason. I am
  // not sure, but I think it is because of strict mode
  // characteristic that prevents accessing implied this?
  // But, then, why does this.scoreElement work??

  lucu.element.forEach(elements, this.scoreElement.bind(this));

  // NOTE: this next function must be separate (tentatively) because
  // it is based on a ratio of neigboring scores, which mean the
  // score must have settled, which is not done until the first
  // pass completes. so we have to have a separate pass, or we
  // have to redesign applySibBias a different way. I do want
  // to think about how to do this. Like just use some
  // constant score.

  // I also want to redesign applySibBias so it is more 'online'
  // in the sense that it only needs to react to the scores of
  // elements preceding or above it in depth-first-search order.

  // Once the above two tasks are tackled then the call to
  // applySiblingBias can be done as a part of scoreElement in
  // the first pass, making scoring a one pass approach

  // TODO: can i just reuse the previous? maybe
  // lucu.calamine.applySiblingBias would need null checks
  elements = doc.body.getElementsByTagName('*');
  lucu.element.forEach(elements, lucu.calamine.applySiblingBias);
};


//Apply our 'model' to an element. We generate a 'score' that is the
//sum of several terms.

lucu.calamine.scoreElement = function(element) {

  // TODO: split up this giant function


  element.score = element.score || 0;

  this.applyTextScore(element);
  this.applyImageScore(element);
  this.applyPositionScore(element);
  this.applyTagNameScore(element);
  this.applyAttributeScore(element);
  this.applyAncestorBiasScore(element);
  this.applyDescendantBiasScore(element);
};

lucu.calamine.applyTextScore = function(element) {

  if(!element.charCount) {
    return;
  }

  if(lucu.element.isLeafLike(element)) {
    return;
  }

  element.score += -20 * (element.copyrightCount || 0);
  element.score += -20 * (element.dotCount || 0);
  element.score += -10 * (element.pipeCount || 0);

  // Calculate anchor density and store it as an expando
  element.anchorDensity = element.anchorCharCount / element.charCount;

  // TODO: this could still use a lot of improvement. Maybe look at
  // how any decision tree implementations have done it.

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
};


lucu.calamine.applyImageScore = function(element) {

  // NOTE: is there some faster or more appropriate way than matches, like
  // element instanceof HTMLImageElement?

  // element instanceof HTMLImageElement works, but apparently there is a strange
  // issue with cross-frame compatibility.

  if(!element.matches('img')) {
    return;
  }

  var root = element.ownerDocument.body;

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

  // TODO: maybe break this out into its own function

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

  // NOTE: this expects dimensions to be defined for images or it
  // does not behave as well.

  // Image branch property is just a helpful debugging property


  // TODO: rather than mutate the score property, it would be nicer to have
  // a separate function that returns a score. That does, however, make it
  // harder to set imageBranch. So the function would need destructuring which
  // we could mimic by returning [score, imageBranch].

  // TODO: is there some nicer way of updating the parentElement? I am not
  // entirely happy that we secretly update other elements here

  var area = lucu.image.getArea(element);

  if(!isFinite(area)) {

    element.imageBranch = 1;
    element.score += 100;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 100;
    }
  } else if(area > 1E5) {

    // TODO: make a decision about whether to use syntax like 1E5

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

};

lucu.calamine.applyPositionScore = function(element) {

  // Distance from start
  element.score += element.siblingCount ?
    2 - 2 * element.previousSiblingCount / element.siblingCount : 0;

  // Distance from middle
  element.score += element.siblingCount ?
    2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) /
      (element.siblingCount / 2) )  : 0;
};

lucu.calamine.TAG_NAME_BIAS = {
  a: -1,
  address: -3,
  article: 100,
  aside: -200,
  blockquote: 3,
  button: -100,
  dd: -3,
  div: 20,
  dl: -10,
  dt: -3,
  figcaption: 10,
  figure: 10,
  footer: -20,
  font: 0,
  form: -20,
  header: -5,
  h1: -2,
  h2: -2,
  h3: -2,
  h4: -2,
  h5: -2,
  h6: -2,
  li: -20,
  nav: -50,
  ol: -20,
  p: 10,
  pre: 3,
  section: 10,
  small: -1,
  td: 3,
  time: -3,
  tr: 1,
  th: -3,
  ul: -20
};

lucu.calamine.applyTagNameScore = function(element) {

  var bias = lucu.calamine.TAG_NAME_BIAS[element.localName];

  element.score += bias || 0;
};



lucu.calamine.ID_CLASS_BIAS = {
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

// These next two variables are created on the ASSUMPTION that it yields
// better performance regardless of whether the performance is even bad
// in the first place. Never tested perf. This might be stupid.

// Calc once
lucu.calamine.ID_CLASS_KEYS = Object.keys(lucu.calamine.ID_CLASS_BIAS);

// Calc once. I prefer the anon function here since we are in glob scope
lucu.calamine.ID_CLASS_VALUES = lucu.calamine.ID_CLASS_KEYS.map(function(key) {
  return lucu.calamine.ID_CLASS_BIAS[key];
});

lucu.calamine.applyAttributeScore = function(element) {

  if(!element.attributeText) {
    return;
  }

  var text = element.attributeText;
  var summer = lucu.calamine.sumAttributeBiases.bind(this, text);

  element.score += lucu.calamine.ID_CLASS_KEYS.reduce(summer, 0);

  // TODO: propagate partial attribute text bias to children, in the same
  // way that certain ancestor elements bias their children? After all,
  // <article/> should be nearly equivalent to <div id="article"/> ? Does
  // this encroach on tag name bias though?
};

lucu.calamine.sumAttributeBiases = function(text, sum, key, index) {

  var containsKey = text.indexOf(key) > -1;
  var delta = containsKey ? lucu.calamine.ID_CLASS_VALUES[index] : 0;
  return sum + delta;
};


lucu.calamine.ANCESTOR_BIASES = {
  blockquote:10,
  code:10,
  div:1,
  dl:-5,
  header:-5,
  li:-3,
  nav:-20,
  ol:-5,
  p:10,
  pre:10,
  table:-2,
  ul:-5
};

lucu.calamine.applyAncestorBiasScore = function(element) {
  var bias = lucu.calamine.ANCESTOR_BIASES[element.localName];

  if(!bias) {
    return;
  }

  var descendants = element.getElementsByTagName('*');
  var update = lucu.calamine.updateDescendantWithAncestorBias.bind(this, bias);
  lucu.element.forEach(descendants, update);
};

// Private helper
lucu.calamine.updateDescendantWithAncestorBias = function(bias, element) {
  element.score = (element.score || 0) + bias;
};

lucu.calamine.DESCENDANT_BIASES = {
  b: 1,
  blockquote: 3,
  code: 2,
  em: 1,
  h1: 1,
  h2: 1,
  h3: 1,
  h4: 1,
  h5: 1,
  h6: 1,
  i: 1,
  p: 5,
  pre: 2,
  span: 1,
  strong: 1,
  sub: 2,
  sup: 2,
  time: 2
};

lucu.calamine.applyDescendantBiasScore = function(element) {
  var bias = lucu.calamine.DESCENDANT_BIASES[element.localName];

  if(!bias) {
    return;
  }

  var parent = element.parentElement;

  if(!parent) {
    return;
  }

  if(parent == element.ownerDocument.body) {
    return;
  }

  parent.score = (parent.score || 0) + bias;
};

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
 *
 * Want an 'online' approach (not in the Internet sense)
 */
lucu.calamine.applySiblingBias = function(element) {
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
};
