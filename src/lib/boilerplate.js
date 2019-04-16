import assert from '/src/lib/assert.js';

// TODO: export a function like block-is-boilerplate or block-is-content instead
// of exporting this raw score. I prefer score to be as opaque as possible and
// exporting this is just too low level, the api is too technical as a result.
export const neutralScore = 50;

// Given a dataset representing content sections of a document, produce a scored
// dataset indicating which elements in the dataset are boilerplate.
//
// Options:
// - tailSize {Number} optional, should be in range [0..0.5), determines what
// percentage of content blocks fall into header and footer sections
// - documentArea {Number} optional, the default dimensions of a document to
// use when determining the proportional size of content blocks
// - minimumContentThreshold {Number} optional, should be in range 0-100,
// indicating minimum desired percentage of content vs. boilerplate
export function classify(dataset, scoreBlock, options = {}) {
  assert(Array.isArray(dataset));

  if (!dataset.length) {
    return dataset;
  }

  const doc = dataset[0].element.ownerDocument;
  assert(typeof doc === 'object');
  assert(typeof scoreBlock === 'function');


  const tailSize = isNaN(options.tailSize) ? 0.2 : options.tailSize;
  assert(!isNaN(tailSize));
  assert(tailSize >= 0 && tailSize < 0.5);

  const defaultDocumentArea = 1500 * 2000;
  const documentArea = isNaN(options.documentArea) ? defaultDocumentArea : options.documentArea;
  assert(Number.isInteger(documentArea));
  assert(documentArea >= 0);

  // TODO: move closer to use case
  const defaultMinimumContentThreshold = 20;
  let minimumContentThreshold = isNaN(options.minimumContentThreshold) ?
    defaultMinimumContentThreshold : options.minimumContentThreshold;
  minimumContentThreshold /= 100;

  let textLength = 0;
  if (doc.body) {
    textLength = computeTextLength(doc.body.textContent);
  }

  let numElements = 0;
  if (doc.body) {
    numElements = doc.body.getElementsByTagName('*').length;
  }
  const frontMax = (tailSize * numElements) | 0;
  const endMin = numElements - frontMax;

  const info = {
    textLength,
    frontMax,
    endMin,
    area: documentArea
  };

  for (const block of dataset) {
    block.score = scoreBlock(block, info, neutralScore);
  }

  // adjustment options
  const ao = {};
  ao.documentLength = textLength;
  ao.delta = 2;
  ao.maxIterations = 20;
  ao.contentThreshold = neutralScore;
  ao.ratioThreshold = minimumContentThreshold;
  return adjustScores(dataset, ao);
}

// Given a scored dataset representing a document, annotate the document
export function annotateDocument(doc, dataset) {
  for (const block of dataset) {
    const element = findBlockElement(doc, block);
    if (!element) {
      continue;
    }

    element.setAttribute('score', block.score);

    if (block.score > 74) {
      element.setAttribute('boilerplate', 'lowest');
    } else if (block.score > 49) {
      element.setAttribute('boilerplate', 'low');
    } else if (block.score > 24) {
      element.setAttribute('boilerplate', 'high');
    } else {
      element.setAttribute('boilerplate', 'highest');
    }
  }
}

// Given a block, get its represented element
export function findBlockElement(doc, block) {
  // TODO: for now, cheat, but maybe use something like element index
  assert(block.element);
  assert(block.element.ownerDocument === doc);
  return block.element;
}

export function adjustScores(blocks, options) {
  let { documentLength } = options;
  if (documentLength === undefined) {
    documentLength = 0;
  }

  assert(Number.isInteger(documentLength));

  let { delta } = options;
  if (delta === undefined) {
    delta = 1;
  }

  let { maxIterations } = options;
  if (maxIterations === undefined) {
    maxIterations = 20;
  }

  let { contentThreshold } = options;
  if (contentThreshold === undefined) {
    contentThreshold = 0;
  }

  let { ratioThreshold } = options;
  if (ratioThreshold === undefined) {
    ratioThreshold = 0;
  }

  let iterations = 0;
  let contentLength = getContentLength(blocks, documentLength, contentThreshold);
  let ratio = contentLength / (documentLength || 1);
  while (ratio < ratioThreshold && iterations < maxIterations) {
    let adjustmentPerIteration = 0;

    for (const block of blocks) {
      if (block.score < contentThreshold) {
        block.score += delta;
        adjustmentPerIteration += delta;
      }
    }

    if (adjustmentPerIteration === 0) {
      break;
    }

    contentLength = getContentLength(blocks, documentLength, contentThreshold);
    ratio = contentLength / (documentLength || 1);
    iterations += 1;
  }

  return blocks;
}

// Get the total length of non-boilerplate content. This works
// counter-intuitively by finding the disjoint set of boilerplate blocks,
// summing their lengths, and substracting that from document length. This
// strange way of doing this avoids issues with double counting lengths of
// nested non-boilerplate blocks.
export function getContentLength(blocks, documentLength, threshold) {
  // Assume documentLength is >= 0.

  // Avoid doing work if there is no point
  if (documentLength === 0) {
    return 0;
  }

  let length = 0;
  for (const block of blocks) {
    if (block.score < threshold &&
        !hasBoilerplateAncestor(blocks, block, threshold)) {
      length += block.textLength;
    }
  }

  return documentLength - length;
}

// Given a block, check its ancestors. If any ancestor is boilerplate, return
// true. Otherwise, return false. The block itself is not considered.
// TODO: should block be the first parameter since that is what this primarily
// operates on?
// TODO: is threshold an ambiguous name for a parameter?
function hasBoilerplateAncestor(blocks, block, threshold) {
  // We assume blocks is a defined array of blocks with at least one block.
  // We assume block is a defined block object.
  // We assume threshold is an integer
  // We assume that if parentBlockIndex is not -1, it points to a valid
  // in-bounds index of another block that is also a defined block object.
  // We assume that block has a score property that was set previously.

  let index = block.parentBlockIndex;
  while (index !== -1) {
    const cursor = blocks[index];
    if (cursor.score < threshold) {
      return true; // found a boilerplate ancestor
    }
    index = cursor.parentBlockIndex;
  }

  // either no ancestors, or no boilerplate ancestors found
  return false;
}

// TODO: score should not be a built in property. a block is only concerned with
// representing the parsed featured of a block, not its derived features,
// whether those derived features are variables for later heuristics or the
// final classification. this also means that initial score should not be a
// parameter.

// A block is a representation of a portion of a document's content along with
// some derived properties.
//
// @param element {Element} a live reference to the element in a document that
// this block represents
// @param elementIndex {Number} the index of the block in the all-body-elements
// array
export function Block(element, initialScore = 0, elementIndex = -1) {
  this.element = element;
  this.elementIndex = elementIndex;
  this.parentBlockIndex = -1;
  this.elementType = undefined;
  this.depth = -1;
  this.textLength = -1;
  this.lineCount = 0;
  this.imageArea = 0;
  this.listItemCount = 0;
  this.paragrahCount = 0;
  this.fieldCount = 0;
  this.attributeTokens = [];

  this.score = initialScore;
}

// Blocks are distinguishable areas of content
// NOTE: lists (ol/ul/dl) excluded at the moment due to bad scoring
// TODO: i need to somehow reintroduce support for treating lists as
// distinguishable blocks. For example, <ul old-id="breadcrumbs"></ul> is a
// standalone section of content that should be removable
// NOTE: <code> excluded at the moment, maybe permanently

// TODO: I would prefer that neutralScore not be a parameter. but right now
// it is needed to properly initialize blocks. so i need to change block
// constructor first then remove it here.

// Given a document, produce an array of blocks
export function parseBlocks(doc, neutralScore) {
  if (!doc.body) {
    return [];
  }

  const blockElementNames = [
    'article', 'aside', 'blockquote', 'div', 'figure', 'footer', 'header',
    'layer', 'main', 'mainmenu', 'menu', 'nav', 'picture', 'pre', 'section',
    'table', 'td', 'tr'
  ];

  // NOTE: while it is tempting to use a selector that traverses only those
  // elements that are block candidates, this would deny us from tracking the
  // proper index into a collection of all dom elements. We need to track the
  // all-elements index so that we can find which element corresponds to which
  // block later (if and once I remove the element property from a block).

  const elements = doc.body.getElementsByTagName('*');
  const blocks = [];
  for (let elementIndex = 0, len = elements.length; elementIndex < len;
    elementIndex += 1) {
    const element = elements[elementIndex];
    if (blockElementNames.includes(element.localName)) {
      const block = new Block(element, neutralScore, elementIndex);
      findAndSetParent(blocks, block, element);
      blocks.push(block);
    }
  }

  return blocks;
}

// TODO: this should be composable, like find-parent + set-parent-prop, not this
// compound verb
function findAndSetParent(blocks, block, element) {
  // We walk backwards because the parent is most likely to be the preceding
  // block (the last block in the array) at the time this is called.

  for (let index = blocks.length - 1; index > -1; index -= 1) {
    if (blocks[index].element.contains(element)) {
      block.parentBlockIndex = index;
      break;
    }
  }
}

// This module focuses on setting derived properties of blocks in the dataset
// by analyzing the content of each block.
// TODO: maybe specifying the Block type was bad, I should simply use a generic
// dictionary

// TODO: the main export is public facing, so it would be appropriate to use
// an assertion or two to check against bad parameters (TypeErrors).

// TODO: for now this will directly set pre-existing properties of block
// objects. However that may be the wrong coupling. It could be better if the
// block object format has no apriori knowledge of which features will be added.
// That was the format does not need to change as new features are developed and
// as old featuers are removed. It might also improve how features are then
// later inspected, because the inspector already possesses the expectation that
// some features may be missing. By having 'features' be a bag properties this
// seems to fall more in line with that optional sense. So a block object should
// instead have a property called features, which points to another object.
// Then, this function should just be (1) lazily creating the features object,
// and (2) setting the properties of the features object. Furthermore, it will
// better delineate between block structure features (like the block index
// property), and misc derived heuristic features set here. However, before
// doing this change, I am first going to focus on refactoring the current
// implementation which is presently monolothic into more of a distributed
// monolith.

// TODO: the basic features like elementType should be done in the block
// generation algorithm, not as a part of feature extraction

// TODO: attribute tokens should maybe be grouped into buckets of bad/good,
// and as separate features like bad_token_count and good_token_count, and
// then some uniform weight is applied in the scoring section

// TODO: each feature extraction helper should maybe operate on the block,
// not the particular properties of the block, so block should be the parameter,
// this makes it easier to call the various extractor functions, makes it eaiser
// to thoughtlessly add new ones

// TODO: i think the helpers need to be better named, get implies simple prop
// access, these are doing calculation

// Options:
// maxTokenLength - the maximum number of characters per token when analyzing
// attribute tokens

export function extractFeatures(dataset, options = {}) {
  const maxTokenLength = options.maxTokenLength || 15;

  for (const block of dataset) {
    block.elementType = block.element.localName;
    block.depth = getNodeDepth(block.element);
    block.textLength = computeTextLength(block.element.textContent);
    block.anchorTextLength = getAnchorTextLength(block.element);
    block.listItemCount = getListItemCount(block.element);
    block.paragrahCount = getParagraphCount(block.element);
    block.fieldCount = getFieldCount(block.element);
    block.lineCount = getLineCount(block.element, block.textLength);
    block.imageArea = getDescendantImageArea(block.element);
    block.attributeTokens = getAttributeTokens(block.element, maxTokenLength);
  }

  return dataset;
}

// Return the distance of the node to the owning document's root node.
function getNodeDepth(node) {
  node = node.parentNode;
  let depth = 0;
  while (node) {
    node = node.parentNode;
    depth += 1;
  }
  return depth;
}

// Find the count of characters in anchors that are anywhere in the descendant
// hierarchy of this element. This assumes anchors do not contain each other
// (e.g. not misnested).
function getAnchorTextLength(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLength = 0;
  for (const anchor of anchors) {
    const textLength = computeTextLength(anchor.textContent);
    anchorLength += textLength;
  }
  return anchorLength;
}

// Count the number of descendant list items
function getListItemCount(element) {
  return element.querySelectorAll('li, dd, dt').length;
}

// Returns the approximate number of paragraphs in an element. This only looks
// at immediate children, not all descendants. This is naive because it is fast
// and I am not sure how useful it is to do all the extra work to make it more
// accurate. This logic is unrelated to the line counting logic. This logic
// currently ignores many things like double-line-break in preformatted text.
// TODO: rename to get_child_paragraph_count to make it even more obvious. Or
// consider estimate_child_paragraph_count, to make it even more obvious that it
// is (1) a derivation that involves calculation which is not just simple
// property access as is normally implied by the get qualifier and (2) that it
// is inexact.
// TODO: add support for preformatted text?
// TODO: ensure returning non-0? everything has at least one paragraph, right?
// see what i did for line counting.
// TODO: it is possible this should be a derivation of line counting instead of
// as a separate analysis.
// TODO: is this the best way to walk child elements?
// TODO: profile
// TODO: implement testing
function getParagraphCount(element) {
  // We actually match multiple paragraph-like items, not just paragraph tags.
  // We are actually looking for all text-breaking features.
  const names = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  let count = 0;
  for (let child = element.firstElementChild; child;
    child = child.nextElementSibling) {
    if (names.includes(child.localName)) {
      count += 1;
    }
  }
  return count;
}

// Returns an approximate count of the number of lines in a block of text
function getLineCount(element, textLength) {
  if (!textLength) {
    return 1;
  }

  const lineSplitterElementNames = [
    'br', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li',
    'menuitem', 'p', 'tr'
  ];

  const selector = lineSplitterElementNames.join(',');
  const elements = element.querySelectorAll(selector);
  let lineCount = elements.length;

  // Special handling for preformatted text
  let newlineCount = 0;
  if (['pre', 'code'].includes(element.localName)) {
    const lines = element.textContent.split('\n');
    newlineCount = lines.length;
  }
  lineCount += newlineCount;

  return lineCount || 1;
}

function getFieldCount(element) {
  return element.querySelectorAll('input, select, button, textarea').length;
}

// Get the total area of all descendant images
function getDescendantImageArea(element) {
  const images = element.getElementsByTagName('img');
  let area = 0;
  for (const image of images) {
    area += image.width * image.height;
  }
  return area;
}

// Return a set of distinct lowercase tokens from some of the values of the
// element's attributes
function getAttributeTokens(element, maxLength) {
  const keys = ['id', 'name', 'class', 'itemprop', 'role'];
  const values = keys.map(key => element.getAttribute(key));
  const joinedValues = values.join(' ');
  const normalValues = joinedValues.toLowerCase();
  const tokens = tokenize(normalValues);
  const tokenSet = createTokenSet(tokens);
  return maxLength > 0 ? tokenSet.filter(t => t.length <= maxLength) : tokenSet;
}

function tokenize(value) {
  const values = value.split(/[\s\-_0-9]+/g);
  const nonEmptyValues = values.filter(v => v);
  return nonEmptyValues;
}

function createTokenSet(tokens) {
  // We do not use a real Set here. Set is slow. It is faster to use a simple
  // array.

  const set = [];
  for (const token of tokens) {
    if (!set.includes(token)) {
      set.push(token);
    }
  }
  return set;
}

const tokenWeights = {
  account: -10,
  ad: -50,
  ads: -50,
  advert: -50,
  advertisement: -50,
  article: 30,
  author: -10,
  bio: -20,
  body: 20,
  bottom: -10,
  branding: -10,
  breadcrumbs: -10,
  carousel: -10,
  cit: 10, // citation abbreviation
  citation: 10,
  cmt: -10,
  col: -2,
  colm: -2, // column abbreviation
  comment: -40,
  comments: -50,
  contact: -10,
  content: 20,
  contentpane: 50,
  cookie: -10,
  copyright: -10,
  credit: -2,
  date: -10,
  details: -20,
  disqus: -40,
  dsq: -30, // disqus abbreviation
  entry: 10,
  fb: -5, // facebook
  figure: 10,
  fixture: -5,
  footer: -40,
  furniture: -5,
  gutter: -30,
  header: -10,
  headline: -5,
  keywords: -10,
  left: -20,
  links: -10,
  list: -10,
  login: -30,
  main: 30,
  meta: -30,
  metadata: -10,
  mini: -5,
  more: -15,
  nav: -30,
  navbar: -30,
  navigation: -20,
  newsarticle: 50,
  newsletter: -20,
  page: 10,
  popular: -30,
  post: 20,
  primary: 10,
  promo: -50,
  promotion: -50,
  rail: -50,
  recirculation: -20,
  recommend: -10,
  recommended: -10,
  ref: 5,
  reference: 25,
  register: -30,
  rel: -50,
  relate: -50,
  related: -50,
  right: -50,
  rightcolumn: -20,
  secondary: -20,
  share: -20,
  side: -5,
  sidebar: -20,
  sign: -10,
  signup: -30,
  skip: -5,
  social: -30,
  splash: -10,
  sticky: -10,
  story: 50,
  storytxt: 50,
  stub: -10,
  subscribe: -30,
  subscription: -20,
  survey: -10,
  tag: -15,
  tags: -20,
  tease: -20,
  teaser: -20,
  thread: -10,
  tool: -30,
  tools: -30,
  top: -10,
  trend: -5,
  trending: -10,
  utility: -10,
  widget: -20,
  zone: -20
};

const typeBiasMap = {
  article: 20,
  blockquote: 5,
  section: 0,
  layer: 0,
  cite: 10,
  code: 10,
  div: 0,
  dl: 0,
  td: 0,
  table: 0,
  header: -10,
  figure: 5,
  footer: -10,
  ul: 0,
  aside: -5,
  nav: -20,
  menu: -20,
  menuitem: 0,
  ol: 0,
  pre: 5
};

export function scoreBlock(block, info, neutralScore) {
  let score = neutralScore;
  score += deriveDepthBias(block.depth);
  score += deriveElementTypeBias(block.elementType, typeBiasMap);
  score += deriveTextLengthBias(block.textLength, info.textLength);
  score += deriveLineCountBias(block.textLength, block.lineCount);
  score += deriveAnchorDensityBias(block.anchorTextLength, block.textLength);
  score += deriveListBias(block.element, block.listItemCount);
  score += deriveParagraphBias(block.paragrahCount);
  score += deriveFieldBias(block.fieldCount);
  score += deriveImageBias(block.imageArea, info.area);
  score += derivePositionBias(block.elementIndex, info.frontMax, info.endMin);
  score += deriveAttributeBias(block.attributeTokens, tokenWeights);

  const minScore = 0;
  const maxScore = 100;
  return Math.max(minScore, Math.min(score, maxScore));
}

// Calculates a bias that should increase or decrease an element's boilerplate
// score based on the element's depth. The general heuristic is that the deeper
// the node, the greater the probability it is boilerplate. There is no risk
// of the document element or the body element from being scored because
// analysis starts from within body, so depth values 0 and 1 are grouped into
// the first bin and do not get any explicit treatment.
function deriveDepthBias(depth) {
  // NOTE: the coefficient used here was chosen empirically, need to do actual
  // analysis using something like linear regression, i am not even sure depth
  // is a great independent variable, this is also why i capped it to limit its
  // impact
  const slope = -4;
  let bias = slope * depth + 10;
  bias = Math.max(-5, Math.min(5, bias));
  return bias;
}

function deriveElementTypeBias(elementType, weights) {
  const bias = weights[elementType];
  return bias || 0;
}

// Calculate a bias for an element's score based on the amount of text it
// contains relative to the overall amount of text in the document. Generally,
// large blocks of text are not boilerplate.
function deriveTextLengthBias(blockTextLength, documentTextLength) {
  if (!documentTextLength) {
    return 0;
  }

  if (!blockTextLength) {
    return 0;
  }

  const ratio = blockTextLength / documentTextLength;

  // TODO: should be a param
  const maxTextBias = 5;

  let bias = 500 * ratio;
  bias = Math.min(maxTextBias, bias);

  return bias | 0;
}

// Text with lots of lines and a short amount of text per line is probably
// boilerplate, whereas text with lots of text per line are probably content.
// TODO: use a coefficient instead instead of bin thresholds
function deriveLineCountBias(textLength, lineCount) {
  // Calculate the typical text length of the lines of the block
  // TODO: the rounding can occur on the bias value after applying the
  // coefficient, we don't need to round lines here
  const lineLength = (textLength / (lineCount || 1)) | 0;

  if (lineLength > 100) {
    return 5;
  } if (lineLength > 50) {
    return 0;
  } if (lineLength > 20) {
    return -1;
  } if (lineLength > 1) {
    return -5;
  }
  return 0;
}

// Assumes that anchors are not blocks themselves
function deriveAnchorDensityBias(anchorTextLength, textLength) {
  const ratio = anchorTextLength / (textLength || 1);

  // TODO: use a coefficient and round instead of bin
  if (ratio > 0.9) {
    return -40;
  } if (ratio > 0.5) {
    return -20;
  } if (ratio > 0.25) {
    return -5;
  }
  return 0;
}

// TODO: this should not depend on element, somehow, maybe use a block_type
// that is a category of tags (e.g. list, container). This should only depend
// on features. Even if I just add an 'is-list' feature, that is an improvement
function deriveListBias(element, listItemCount) {
  // Do not punish lists themselves
  if (['ol', 'ul', 'dl'].includes(element.localName)) {
    return 0;
  }

  return Math.max(-5, -1 * listItemCount);
}

function deriveParagraphBias(paragrahCount) {
  return Math.min(20, paragrahCount * 5);
}

function deriveFieldBias(fieldCount) {
  return fieldCount > 0 && fieldCount < 10 ? -10 : 0;
}

function deriveImageBias(imageArea, documentArea) {
  return Math.min(70, (70 * imageArea / documentArea) | 0);
}

function derivePositionBias(index, frontMax, endMin) {
  // If the element is located near the start or the end then penalize it
  if (index < frontMax || index > endMin) {
    return -5;
  }
  return 0;
}

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function deriveAttributeBias(tokens, tokenWeights) {
  let bias = 0;
  for (const token of tokens) {
    bias += tokenWeights[token] || 0;
  }
  return bias;
}

// Return an approximate count of the characters in a string. This ignores outer
// whitespace and excessive inner whitespace.
export function computeTextLength(text) {
  return text.trim().replace(/\s\s+/g, ' ').length;
}
