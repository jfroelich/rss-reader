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

  // Computes a bias for an element based on the values of some of its
  // attributes.
  // Using var due to v8 deopt warnings - Unsupported use of phi const

  deriveAttrBias(element) {

    var totalBias = 0;

    // Start by merging the element's interesting attribute values into a
    // string in preparation for tokenization. The values are merged because it
    // is faster to process a single large string than several small strings
    // Accessing attributes by property is faster than using getAttribute. It
    // turns out that getAttribute is horribly slow in Chrome. I have not
    // figured out why.
    var valsArray = [element.id, element.name, element.className];
    // join implicitly filters undefined values
    var valsString = valsArray.join(' ');

    // If the element did not have attribute values, then valsString only
    // contains whitespace or some negligible token, so exit early.
    if(valsString.length < 3)
      return totalBias;

    // Lowercase the values in one pass. Even though toLowerCase now has to
    // consider extra spaces in its input because it occurs after the join, we
    // don't have to check if inputs are defined non-natively because join did
    // that for us. Also, this is one function call in contrast to 3. toLowerCase
    // scales better with larger strings that the JS engine scales with function
    // calls.
    var normValsString = valsString.toLowerCase();
    var tokenArray = normValsString.split(/[\s\-_0-9]+/g);

    // Now add up the bias of each distinct token. Previously this was done in
    // two passes, with the first pass generating a new array of distinct tokens,
    // and the second pass summing up the distinct token biases. I seem to get
    // better performance without creating an intermediate array.
    var tokenArrayLen = tokenArray.length;

    // I use the in operator to test membership which follows the prototype
    // so i think it makes sense to reduce the scope of the lookup by excluding
    // the prototype here. I have some concern that this actually reduces
    // performance though, and need to profile
    var seenTokens = Object.create(null);

    var bias = 0;
    var token;

    // Not using for..of here due to deopt warnings
    for(var i = 0; i < tokenArrayLen; i++) {
      token = tokenArray[i];

      // Split can yield empty strings, so skip those.
      if(!token)
        continue;

      if(token in seenTokens)
        continue;
      else
        seenTokens[token] = 1;

      bias = this.attrTokenWeights[token];
      if(bias)
        totalBias += bias;
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
      score += this.deriveImgBias(element);
      score += this.deriveAttrBias(element);
      if(score > highScore) {
        bestElement = element;
        highScore = score;
      }
    }

    return bestElement;
  }

  deriveImgBias(parentElement) {
    let bias = 0.0;
    let numImgs = 0;

    for(let element = parentElement.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.localName !== 'img')
        continue;
      numImgs++;

      // Reward large images
      let area = element.width * element.height;
      if(area)
        bias = bias + (0.0015 * Math.min(100000.0, area));

      // Reward supporting text
      if(element.getAttribute('alt'))
        bias = bias + 20.0;
      if(element.getAttribute('title'))
        bias = bias + 30.0;
      if(this.findCaption(element))
        bias = bias + 100.0;
    }

    // Penalize carousels
    if(numImgs > 1)
      bias = bias + (-50.0 * (numImgs - 1));
    return bias;
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

    // The doc element contains check also avoids calling remove on detached
    // elements
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
