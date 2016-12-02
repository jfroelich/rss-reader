// See license.md

'use strict';

class BoilerplateFilter {

  constructor() {
    // These scores adjust the parent scores of these elements.
    // TODO: switch back to lowercase and use node.localName to lookup
    this.ancestorBiases = {
      'A': -5,
      'ASIDE': -50,
      'BLOCKQUOTE': 20,
      'BR': 3,
      'DIV': -50,
      'FIGURE': 20,
      'H1': 10,
      'H2': 10,
      'H3': 10,
      'H4': 10,
      'H5': 10,
      'H6': 10,
      'NAV': -100,
      'OL': -20,
      'P': 10,
      'PRE': 10,
      'SECTION': -20,
      'UL': -20
    };

    // Bias elements with attribute values containing these tokens
    this.attrTokenWeights = {
      'ad': -500,
      'ads': -500,
      'advert': -500,
      'article': 500,
      'body': 500,
      'comment': -500,
      'content': 500,
      'contentpane': 500,
      'gutter': -300,
      'left': -50,
      'main': 500,
      'meta': -50,
      'nav': -200,
      'navbar': -200,
      'newsarticle': 500,
      'page': 200,
      'post': 300,
      'promo': -100,
      'rail': -300,
      'rel': -50,
      'relate': -500,
      'related': -500,
      'right': -50,
      'social': -200,
      'story': 100,
      'storytxt': 500,
      'tool': -200,
      'tools': -200,
      'widget': -200,
      'zone': -50
    };
  }

  filterDocument(doc) {
    // Nothing to do without a body
    if(!doc.body)
      return;

    const bestElement = this.findHighScoreElement(doc);
    this.prune(doc, bestElement);
  }

  // Bias an element based on the text it contains and the ratio of the text
  // outside of anchors to text inside of anchors. See:
  // http://www.l3s.de/~kohlschuetter/boilerplate
  deriveTextBias(element) {
    const text = element.textContent.trim();
    const textLen = 0.0 + text.length;
    const anchorLen = 0.0 + this.deriveAnchorLen(element);
    return (0.25 * textLen) - (0.7 * anchorLen);
  }

  // Returns the approximate number of characters contained within anchors
  // that are descendants of the element. Assumes no anchor nesting.
  deriveAnchorLen(element) {
    let anchorLen = 0;
    const anchors = element.querySelectorAll('a[href]');
    for(let anchor of anchors) {
      anchorLen = anchorLen + anchor.textContent.trim().length;
    }
    return anchorLen;
  }

  deriveAncestorBias(element) {
    let totalBias = 0;
    for(let child = element.firstElementChild; child;
      child = child.nextElementSibling) {
      const bias = this.ancestorBiases[child.nodeName];
      if(bias)
        totalBias = totalBias + bias;
    }

    return totalBias;
  }

  // Using var due to v8 deopt warnings - Unsupported use of phi const
  deriveAttrBias(element) {
    var totalBias = 0;
    var valsArray = [element.id, element.name, element.className];
    var valsString = valsArray.join(' ');
    if(valsString.length < 3)
      return totalBias;
    var normValsString = valsString.toLowerCase();
    var tokenArray = normValsString.split(/[\s\-_0-9]+/g);
    var tokenArrayLen = tokenArray.length;
    var seenTokens = {};
    var bias = 0;
    var token = null;

    for(var i = 0; i < tokenArrayLen; i++) {
      token = tokenArray[i];
      if(!token) continue;
      if(token in seenTokens) continue;
      seenTokens[token] = 1;
      bias = this.attrTokenWeights[token];
      if(bias)
        totalBias = totalBias + bias;
    }

    return totalBias;
  }

  findHighScoreElement(doc) {
    // TODO: switch back to lowercase
    // Using var due to V8 deopt warning "unsupported compound let statement"
    var candidateSelector =
      'ARTICLE, CONTENT, DIV, LAYER, MAIN, SECTION, SPAN, TD';
    var listSelector = 'LI, OL, UL, DD, DL, DT';
    var navSelector = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

    // Default to the root of the document
    var bestElement = doc.documentElement;

    var body = doc.body;
    if(!body)
      return bestElement;
    var elements = body.querySelectorAll(candidateSelector);
    var highScore = 0.0;

    for(var element of elements) {
      var score = 0.0 + this.deriveTextBias(element);
      if(element.closest(listSelector))
        score -= 200.0;
      if(element.closest(navSelector))
        score -= 500.0;
      score += this.deriveAncestorBias(element);
      score += this.deriveImageBias(element);
      score += this.deriveAttrBias(element);
      if(score > highScore) {
        bestElement = element;
        highScore = score;
      }
    }

    return bestElement;
  }

  deriveImageBias(parentElement) {
    let bias = 0.0;
    let images = this.getChildImages(parentElement);
    for(let image of images) {
      bias += this.getAreaBias(image) + this.getSupportingTextBias(image);
    }
    bias += this.getCarouselBias(images);
    return bias;
  }

  getChildImages(element) {
    const nodes = element.childNodes;
    return Array.prototype.filter.call(nodes,
      (node) => node.localName === 'img');
  }

  // Penalize carousels
  getCarouselBias(images) {
    let bias = 0;
    const numImages = images.length;
    if(numImages > 1)
      bias = -50 * (numImages - 1);
    return bias;
  }

  // Reward supporting text
  getSupportingTextBias(image) {
    let bias = 0;
    if(image.hasAttribute('alt'))
      bias += 20;
    if(image.hasAttribute('title'))
      bias += 30;
    if(this.findCaption(image))
      bias += 100;
    return bias;
  }

  // Reward large images
  getAreaBias(image) {
    let area = image.width * image.height;
    return area ? 0.0015 * Math.min(100000.0, area) : 0.0;
  }

  findCaption(image) {
    const figure = image.closest('figure');
    return figure ? figure.querySelector('figcaption') : null;
  }

  // Remove elements that do not intersect with the best element
  prune(doc, bestElement) {
    const docElement = doc.documentElement;
    if(bestElement === docElement)
      return;
    const elements = doc.body.querySelectorAll('*');
    for(let element of elements) {
      if(!element.contains(bestElement) &&
        !bestElement.contains(element) &&
        docElement.contains(element)) {
        element.remove();
      }
    }
  }
}
