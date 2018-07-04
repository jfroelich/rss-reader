// Module for classifying html content as boilerplate

// Map of element names to bias values. This heavily penalizes certain elements
// that are indications of navigation or non-content, and remains relatively
// neutral or timid on other types. I include neutrals in the map to be explicit
// about them, even though they produce the equivalent non-bias, because I
// prefer to have the opinion be encoded clearly. We only care about
// container-type elements, as in, those elements which may contain other
// elements, that semantically tend to represent a unit or block of content that
// should be treated as a whole. We do not care about void elements or elements
// that contain only text (generally). This should generally align with the
// container-element-names array, but exact alignment is not important.
const type_bias_map = {
  article: 10,
  blockquote: 5,
  section: 0,
  layer: 0,
  code: 10,
  div: 0,
  dl: 0,
  td: 0,
  table: 0,
  header: -10,
  footer: -10,
  ul: 0,
  aside: -5,
  nav: -20,
  menu: -20,
  menuitem: 0,
  ol: 0,
  pre: 5,
};

const default_average_document_area = 1500 * 2000;


// Names of elements that tend to represent distinguishable areas of content.
// These blocks are generally what will be individually retained or removed
// when later filtering content.
//
// This includes td even though table includes td, because of how tables are
// sometimes used for a layout purpose instead of a semantic purpose.
//
// This does not include paragraphs or header-levels. Paragraphs are not
// isolated blocks which means that the algorithm does not try to analyze or
// filter certain paragraphs.
//
// This generally does not include inline-block elements (e.g. span, a).
const block_element_names = [
  'article', 'aside',  'blockquote', 'code',    'div',  'dl',
  'figure',  'footer', 'header',     'layer',   'main', 'mainmenu',
  'menu',    'nav',    'ol',         'picture', 'pre',  'section',
  'table',   'td',     'tr',         'ul'
];

// The presence of these elements within an element's descendant hierarchy
// is a rough indication of content spanning over a new line.
// TODO: make this more exhaustive, look for typical flow-breaking elements,
// maybe consider any other container-type block. In fact maybe instead of
// line count I should be looking at text-to-child-blocks ratio.
const line_splitter_element_names = [
  'br', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'menuitem',
  'p', 'tr'
];

// Elements are scored on a scale of [0..100]. I've chosen this over using
// negative scores to keep it simple and to treat scores as unsigned. A score
// is similar to a probability of boilerplate. A score of 0 means that we are
// confident a block is content, and a score of 100 means we are confident a
// block is boilerplate. A score of 50 means we totally unsure.
const neutral_score = 50;

// Marks up some of the elements of a document based on whether the elements are
// boilerplate. There are several attributes added to various elements, along
// with a key attribute named "boilerplate" that ultimately indicates whether
// or not the element contains boilerplate.
//
// Boilerplate elements may contain non-boilerplate, and non-boilerplate
// elements may contain boilerplate. Be way of naively pruning all elements
// classified as boilerplate.
//
// This assumes that images have known dimensions (that image.width and
// image.height are not 0). It will not error if the dimensions are missing, but
// it will not consider images in that case.
//
// Ideally this would produce a new document, but instead this mutates the input
// document, because cloning the input is cost-prohibitive.
//
// This does not do any actual pruning of the dom. Instead, this tags elements
// as likely boilerplate, as an intermediate step, so that a later step can
// revist the document and decide how it wants to prune. This splitting up of
// annotation (scoring) and pruning helps keep the algorithm easy to test and
// keeps it easy to analyze classification errors.
//
// @param document {Document} an html document, preferably inert
// @param tail-size {Number} optional, should be between 0 and 0.5. The
// algorithm divides the document into sections of start, middle, and end.
// The tail size is the approximate size of each of the start and end sections,
// e.g. a tail size of 0.2 means that the start section is about 20% of the
// content, and the end section is about 20% of the content, leaving 60% of the
// content in the middle. Content in the tails is more likely to be boilerplate,
// so increasing tail size will tend to increase the amount of boilerplate
// found.
// @param average_document_area {Number} optional, defaults to the default
// constant defined in this module, used to approximate the area of a typical
// desktop screen. This assumes that any given document is generally viewed full
// screen. This is used to estimate the proportional area of a block based
// on any images it contains.
export function annotate(
    document, tail_size = 0.2,
    average_document_area = default_average_document_area) {
  if (!document) {
    throw new TypeError('document must be an instance of Document');
  }

  if (isNaN(tail_size)) {
    throw new TypeError('tail_size is not a number');
  }

  if (tail_size < 0 || tail_size > 0.5) {
    throw new RangeError('tail_size must be in the range [0 .. 0.5]');
  }

  if (isNaN(average_document_area)) {
    throw new TypeError('average_document_area is not a number');
  }

  if (average_document_area < 0) {
    throw new TypeError('average_document_area should be a positive integer');
  }

  // Analysis is restricted to body, because content only appears in the body
  // assuming the document is minimally well-formed. If there is no body then
  // there is no point to analysis.
  if (!document.body) {
    return;
  }

  // Calculate this once for entire document. Note this includes lots of
  // extraneous whitespace like simple text nodes resulting from separating
  // elements on new lines, but the individual element text length calculation
  // is less affected by such nodes.
  const document_text_length = get_text_length(document.body.textContent);

  // If there is no text in the document, analysis will not be very useful.
  // Maybe there is some merit to analyzing images, but right now that is
  // pretty weak, so just exit.
  if (!document_text_length) {
    return;
  }

  // Query for all elements. Using getElementsByTagName because I assume it is
  // faster than querySelectorAll. Also not obvious is that I am using
  // getElementsByTagName to indicate that no mutation will occur, because I
  // almost always use querySelectorAll to allow for easier mutation during
  // iteration.
  const elements = document.body.getElementsByTagName('*');

  // Calculate the length once, as this is not actually a simple property access
  const num_elements = elements.length;

  // Given that we know there is non-0 text length, 0-elements means body is
  // just a bunch of non-element nodes. There is no point to analysis because it
  // all looks like content.
  if (!num_elements) {
    return;
  }

  // Find the cutoff indices into the all-elements array between start-middle
  // and between middle-end. Do this once here because it is loop invariant.
  const front_max = (tail_size * num_elements) | 0;
  const end_min = num_elements - front_max;

  // If the thresholds somehow overlap there is a programmer error
  if (end_min < front_max) {
    throw new Error('Calculated invalid cutoff indices');
  }

  const info = {
    text_length: document_text_length,
    elements_length: num_elements,
    front_max: front_max,
    end_min: end_min,
    area: average_document_area
  };

  const blocks = create_blocks(elements, num_elements);

  for (const block of blocks) {
    extract_block_features(block, info);
  }

  for (const block of blocks) {
    annotate_block(block, info);
  }
}

// Tokenize the elements array into an array of blocks. Returns an array of
// block objects.
function create_blocks(elements, elements_length) {
  const blocks = [];
  for (let i = 0; i < elements_length; i++) {
    const element = elements[i];
    if (block_element_names.includes(element.localName)) {
      const block = new Block();
      block.element = element;
      block.element_index = i;
      block.element_type = element.localName;
      blocks.push(block);
    }
  }

  return blocks;
}

// A block is a representation of a portion of a document's content.
function Block() {
  // A live reference to the node in the full document. Each block tracks its
  // represented root element to allow for deferring processing that depends
  // on the element into later block iterations (later passes).
  this.element = undefined;
  // index into all elements array. This is a representation of the position
  // of the block within the content. -1 means not set or invalid index.
  this.element_index = -1;

  // The element's type (e.g. the tagname), all lowercase, not qualified. This
  // is redundant with the live reference, but the live reference only exists
  // for performance sake. This is the extracted feature out of the reference.
  // The caller is responsible for ensuring correspondence to the element
  // property.
  this.element_type = undefined;

  // The number of node hops to the root node. -1 means invalid
  this.depth = -1;

  // A representation of the count of characters within the element. This is
  // similar to the total length of the text nodes within the element. -1 is
  // an invalid length.
  this.text_length = -1;

  // A representation of the number of lines of content within the block. This
  // does not necessarily correspond to a simple count of '\n' characters. This
  // is more of an approximation of how many flow-breaks there are within this
  // block of content. Many things within the block content can cause a
  // flow-break, such as the presence of a p tag, or an h1 tag, the start of a
  // table, a new table row, etc.
  this.line_count = 0;

  // The block's content score. On scale of [0..100]. 50 means neutral. 0 means
  // good content, 100 means boilerplate. All blocks start off as neutral.
  this.score = 50;
}

// Populates other properties of the block based on the block's content. The
// goal of feature extraction is not to do any inference, it is just to unpack
// the latent information that is in the content blob into individual
// properties.
function extract_block_features(block, info) {
  block.depth = derive_block_depth(block);
  block.text_length = get_text_length(block.element.textContent);
  block.line_count = count_text_lines(block);
  block.anchor_text_length = derive_anchor_length(block);
}

function derive_block_depth(block) {
  const element = block.element;
  let depth = 0;

  for (let node = element.parentNode; node; node = node.parentNode) {
    depth++;
  }
  return depth;
}

// Determine whether a block is boilerplate.
// @param element {Element} the element to analyze and annotate
// @param index {Number} the index into the all-elements array
// @param num_elements {Number} the length of the all elements array
// @param document_text_length {Number} the approximate character count of all
// text in document.body
// @param front_max {Number} the cutoff index into the all-elements array below
// which an element is considered to be near the start of the document, and
// after which an element is considered to be in the middle of the document
// @param end_min {Number} the cutoff index into the all-elements array below
// which an element is in the middle, and after is near the end.
// @param average_document_area {Number} the approximate size of the window
function annotate_block(block, doc_info) {
  const element = block.element;
  const index = block.element_index;

  // TODO: there is no need to perform these variable assignments. These
  // statements are part of a temporary refactor where I modified the parameters
  // to annotate_block, just to keep the function working after the refactor.
  const num_elements = doc_info.elements_length;
  const document_text_length = doc_info.text_length;
  const front_max = doc_info.front_max;
  const end_min = doc_info.end_min;
  const average_document_area = doc_info.area;

  // TODO: rename bias to score
  // TODO: break these analysis steps into two parts. The first pass is feature
  // extraction, where I populate the block's properties with minimal analysis.
  // The second pass is where functions examine the block's properties to
  // calculate the block's score. The set of functions is the model, and the
  // calculation of the block's score is the scoring of the block.

  let bias = neutral_score;

  const depth_bias = derive_depth_bias(block);
  element.setAttribute('depth-bias', depth_bias);
  bias += depth_bias;

  const type_bias = derive_element_type_bias(block);
  element.setAttribute('type-bias', type_bias);
  bias += type_bias;

  const text_bias = derive_text_length_bias(block, doc_info);
  element.setAttribute('text-bias', text_bias);
  bias += text_bias;

  const line_count_bias = derive_line_count_bias(block);
  element.setAttribute('line-count-bias', line_count_bias);
  bias += line_count_bias;

  const anchor_density_bias = derive_anchor_density_bias(block);
  element.setAttribute('anchor-density-bias', anchor_density_bias);
  bias += anchor_density_bias;

  const list_bias = derive_list_bias(element);
  element.setAttribute('list-bias', list_bias);
  bias += list_bias;

  const paragraph_bias = derive_paragraph_bias(element);
  element.setAttribute('paragraph-bias', paragraph_bias);
  bias += paragraph_bias;

  const form_bias = derive_form_bias(element);
  element.setAttribute('form-bias', form_bias);
  bias += form_bias;

  const image_bias = derive_image_bias(element, average_document_area);
  element.setAttribute('image-bias', image_bias);
  bias += image_bias;

  const position_bias =
      derive_position_bias(element, index, front_max, end_min);
  element.setAttribute('position-bias', position_bias);
  bias += position_bias;

  const attribute_bias = derive_attribute_bias(element);
  element.setAttribute('attribute-bias', attribute_bias);
  bias += attribute_bias;

  // Just leave neutral elements as is, there is nothing to do
  if (bias === 50) {
    return;
  }

  // Clamp bias in [0..100]. We allow for the probability to go out of range
  // during analysis, but here we return it to within range. We allow it to
  // temporarily go out of range because this avoids losing some bias that
  // would otherwise be truncated away if we keep bias within range.
  bias = Math.min(bias, 100);
  bias = Math.max(0, bias);

  element.setAttribute('boilerplate-bias', bias);

  if (bias > 75) {
    element.setAttribute('boilerplate', 'lowest');
  } else if (bias > 50) {
    element.setAttribute('boilerplate', 'low');
  } else if (bias === 50) {
    element.setAttribute('boilerplate', 'neutral');
  } else if (bias > 25) {
    element.setAttribute('boilerplate', 'high');
  } else {
    element.setAttribute('boilerplate', 'highest');
  }
}

function derive_depth_bias(block) {
  const d = block.depth;


  if (d < 2) {
    // documentElement is 0
    // body is 1
    return 50;
  } else if (d < 4) {
    return 20;
  } else if (d < 5) {
    return 5;
  } else if (d < 10) {
    return 0;
  } else {
    return -2;
  }
}

function derive_text_length_bias(block, info) {
  const document_text_length = info.text_length;
  if (!document_text_length) {
    return 0;
  }

  if (!block.text_length) {
    return 0;
  }

  const ratio = block.text_length / document_text_length;

  const max_text_bias = 5;

  // Calc bias
  let bias = (100 * ratio * max_text_bias) | 0;
  // Cap influence to max
  bias = Math.min(max_text_bias, bias);

  return bias;
}

function derive_line_count_bias(block) {
  if (!block.text_length) {
    return 0;
  }

  const line_count = block.line_count;

  // Ignore text that is basically too small. The line count heuristic probably
  // is not worth that much in this case. The inference is too tenuous.
  if (line_count < 3) {
    return 0;
  }

  const text_per_line = (block.text_length / line_count) | 0;

  // TEMP: debugging
  // console.debug(block.text_length, line_count, text_per_line);
  block.element.setAttribute('text-per-line', text_per_line);

  // Text with lots of lines and a short amount of text per line is probably
  // boilerplate, where as text with lots of text per line are probably content.
  if (text_per_line > 100) {
    return 5;
  } else if (text_per_line > 50) {
    return 0;
  } else if (text_per_line > 20) {
    return -1;
  } else {
    return -5;
  }
}

function derive_anchor_density_bias(block) {
  const ratio = block.anchor_text_length / (block.text_length || 1);

  if (block.element_type === 'a') {
    // This heuristic is only valid for non-anchor blocks
    return 0;
  } else if (ratio > 0.9) {
    return -40;
  } else if (ratio > 0.5) {
    return -20;
  } else if (ratio > 0.25) {
    return -5;
  } else {
    return 0;
  }
}

function get_text_length(text) {
  // We trim separately so that basic text nodes like author pressing
  // enter between elements are completely excluded
  const trimmed_text = text.trim();
  // then we condense so as to normalize inner extra space
  const condensed_text = trimmed_text.replace(/\s{2,}/g, ' ');
  return condensed_text.length;
}



function derive_element_type_bias(block) {
  const bias = type_bias_map[block.element_type];
  return bias ? bias : 0;
}

function derive_paragraph_bias(element) {
  let pcount = 0;
  for (let child = element.firstElementChild; child;
       child = child.nextElementSibling) {
    if (child.localName === 'p') {
      pcount++;
    }
  }

  let bias = pcount * 5;
  bias = Math.min(20, bias);
  return bias;
}



function derive_image_bias(element, average_document_area) {
  const max_width = 2000;
  const max_height = 1500;

  // This is a conservative approach to calculating total area from nested
  // images

  const images = element.querySelectorAll('img');
  let total_image_area = 0;
  for (const image of images) {
    if (image.width && image.height) {
      const area =
          Math.min(image.width, max_width) * Math.min(image.height, max_height);
      if (area > 0) {
        total_image_area += area;
      }
    }
  }

  if (total_image_area < 1) {
    return 0;
  }

  // TEMP: debugging
  element.setAttribute('image-area', total_image_area);

  const ratio = total_image_area / average_document_area;

  if (ratio > 0.9) {
    return 15;
  } else if (ratio > 5) {
    return 10;
  } else if (ratio > 1) {
    return 5;
  } else {
    return 0;
  }
}

function derive_position_bias(element, index, front_max, end_min) {
  // If the element is located near the start or the end then penalize it
  if (index < front_max || index > end_min) {
    return -5;
  }
  return 0;
}

function derive_form_bias(element) {
  const fields =
      element.querySelectorAll('form, input, select, button, textarea');

  if (fields.length > 10) {
    return 0;
  } else if (fields.length > 0) {
    return -10;
  } else {
    return 0;
  }
}

function derive_list_bias(element) {
  const items = element.querySelectorAll('li, dd, dt');
  let bias = -1 * items.length;
  bias = Math.max(-20, bias);
  return bias;
}

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function derive_attribute_bias(element) {
  // Accessing attribute values by property appears to be a tiny bit faster

  const vals = [
    element.id, element.name, element.className,
    element.getAttribute('itemprop')
  ];

  // It is not obvious, so note that join implicitly filters undefined values so
  // no need to explicitly check
  const joined_vals = vals.join(' ');

  // If the overall text length is small, then probably do not worth doing
  // token analysis
  if (joined_vals.length < 3) {
    return 0;
  }

  // It is faster to use one lowercase call on the entire string than
  // calling lowercase on each token separately

  // TODO: also need to split on camelcase, like in the string "appendedAds",
  // I would prefer to get two tokens "appended" and "ads". This means the
  // current approach of lowercase-all will not suffice, and the current
  // tokenize algorithm will not suffice.

  const tokens = tokenize(joined_vals.toLowerCase());
  const token_set = [];

  // Inexact, just an upper bound to try and reduce calls
  // TODO: this should be a parameter to function, and treated as constant
  const max_token_len = 15;

  let bias = 0;
  for (const token of tokens) {
    if (token && token.length < max_token_len && !token_set.includes(token)) {
      token_set.push(token);
      const token_bias = token_weights[token];
      if (token_bias) {
        bias += token_bias;
      }
    }
  }

  return bias;
}

function tokenize(value) {
  return value.split(/[\s\-_0-9]+/g);
}

// Find the count of characters in anchors that are anywhere in the
// descendant hierarchy of this element. This assumes anchors do not contain
// each other (e.g. not misnested).
function derive_anchor_length(block) {
  const element = block.element;
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for (const anchor of anchors) {
    const text_length = get_text_length(anchor.textContent);
    anchor_length += text_length;
  }
  return anchor_length;
}

// Returns an approximate count of the number of lines in a block of text
function count_text_lines(block) {
  if (!block.text_length) {
    return 1;
  }

  // Use the number of descendant flow-breaking elements as an estimate of
  // line length.

  const selector = line_splitter_element_names.join(',');
  const elements = block.element.querySelectorAll(line_splitter_element_names);
  let line_count = elements.length;

  // Special handling for preformatted text
  let newline_count = 0;
  if (['pre', 'code'].includes(block.element_type)) {
    const lines = block.element.textContent.split('\n');
    newline_count = lines.length;
  }
  line_count += newline_count;

  // Always count the first line as a line
  if (line_count === 0) {
    line_count = 1;
  }

  return line_count;
}

const token_weights = {
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
  carousel: -10,
  col: -2,
  colm: -2,  // alternate abbr for column
  comment: -40,
  contact: -10,
  content: 20,
  contentpane: 50,
  copyright: -10,
  credit: -2,
  date: -10,
  details: -20,
  disqus: -40,
  dsq: -30,  // disqus abbreviation
  entry: 10,
  fb: -5,  // facebook
  fixture: -5,
  footer: -20,
  furniture: -5,
  gutter: -30,
  header: -10,
  headline: -10,
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
  post: 5,
  primary: 10,
  promo: -50,
  promotion: -50,
  rail: -50,
  recirculation: -20,
  recommend: -10,
  recommended: -10,
  register: -30,
  rel: -50,
  relate: -50,
  related: -50,
  right: -50,
  secondary: -20,
  share: -20,
  side: -5,
  sidebar: -20,
  sign: -10,
  signup: -30,
  social: -30,
  splash: -10,
  story: 50,
  storytxt: 50,
  stub: -10,
  subscription: -20,
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


// TODO: think about image-in-list stuff, such as related-posts sections
// I think the reasoning here is that if an element looks like it occupies
// a large amount of screen space, it probably is not boilerplate. Boilerplate
// tends to be small. But it is hard to penalize small images accurately. So
// look for large images and do a reward.
// TODO: be less naive about hidden images in a carousel, this sums area from
// all of them at the moment, i think, in some cases, unless those hidden ones
// are first filtered out, this leads to erroneously large area
// TODO: maybe image bias should look at ratio to text too, like a total area to
// text length ratio, a kind of nonsensical value, but it could be used in
// general to say that a portion of the content is almost entirely images and no
// text and maybe that says something about boilerplate?

// TODO: target known asides more directly: social, related, featured,
// copyright, menu, advertisement, read more, newsletter signup, site search
// TODO: reward footnotes
// TODO: proximity spreading bias, e.g. content near good content rewarded?
// what about an intermediate ad?

// TODO: I could separate out the model stuff into a separate thing, then
// this takes a model and a document and scores the document using the model,
// but for now I am going to do it all at once.

// TODO: increase list penalty, look at the amount of text within a list vs
// text not in a list

// TODO: slightly penalize any block containing list, or look at ratio of
// text outside of list to text in list

// TODO: counteract list penalty leading to removal of table of contents content
// by rewarding table of contents lists by looking for '#' in anchor url and
// same page url (would need document-url as another parameter, and would need
// to always canonicalize-urls before or access by src property and expect
// base-uri to be set (imply that document is embeddable/standalone))
// TODO: also promote lists without any anchors

// TODO: penalize all next-siblings of footer elements, and all prev siblings
// of header elements

// TODO: depth bias - the closer the content is to the root node, the less
// likely it is bias. this should hopefully offset the over-penalization of
// the root, which blanks the article

// TODO: do a final pass that checks if too little percentage of the annotated
// content is non-boilerplate, and if so, halve the penalties or something
// and reclassify. This is a bailout because the heurstics are too harsh for
// certain content. Basially there should be a minimum amount of content that
// always passes through the filter. To do this efficiently I need to pass over
// block.score. So this has to wait until that is implemented.
