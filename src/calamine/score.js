// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


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
