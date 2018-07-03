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
  'article', 'aside', 'blockquote', 'code', 'div', 'dl', 'footer', 'header',
  'layer', 'main', 'mainmenu', 'menu', 'nav', 'ol', 'pre', 'section', 'table',
  'td', 'ul'
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

  // Finally, iterate over each of the blocks. We iterate over all elements
  // so as to track the per-element index, but we then only pay attention
  // to blocks.
  for (let i = 0; i < num_elements; i++) {
    const element = elements[i];
    if (block_element_names.includes(element.localName)) {
      annotate_block(
          element, i, num_elements, document_text_length, front_max, end_min,
          average_document_area);
    }
  }
}

// TODO: implement. Basically convert the document into a dataset, where a
// dataset is an object with a rows property. Each row represents a block. A
// block is a basic object. It has properties, one of which is the element the
// block reprsents. along with arbitrary other properties. As an intermediate
// step towards that implementation, this for now just creates an array of
// elements.
//
// The thing is, I am not sure if this abstraction adds value. Ambivalent for
// whether I should continue here.
function create_blocks(elements) {
  // TODO: we want a filter operation, along with a map operation

  const rows = [];
  for (const element of elements) {
    if (block_element_names.includes(element.localName)) {
      rows.push(element);
    }
  }
  return rows;
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
function annotate_block(
    element, index, num_elements, document_text_length, front_max, end_min,
    average_document_area) {
  let bias = neutral_score;

  const type_bias = derive_element_type_bias(element);
  element.setAttribute('type-bias', type_bias);
  bias += type_bias;

  const text_bias = derive_text_length_bias(element, document_text_length);
  element.setAttribute('text-bias', text_bias);
  bias += text_bias;

  const line_count_bias = derive_line_count_bias(element);
  element.setAttribute('line-count-bias', line_count_bias);
  bias += line_count_bias;

  const anchor_density_bias = derive_anchor_density_bias(element);
  element.setAttribute('anchor-density-bias', anchor_density_bias);
  bias += anchor_density_bias;

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

function derive_text_length_bias(element, document_text_length) {
  if (!document_text_length) {
    return 0;
  }

  const text_length = get_text_length(element.textContent);
  if (!text_length) {
    return 0;
  }

  const ratio = text_length / document_text_length;

  const max_text_bias = 5;

  // Calc bias
  let bias = (100 * ratio * max_text_bias) | 0;
  // Cap influence to max
  bias = Math.min(max_text_bias, bias);

  return bias;
}

function derive_line_count_bias(element) {
  const text_length = get_text_length(element.textContent);
  if (!text_length) {
    return 0;
  }

  const line_count = count_text_lines(element);

  // Ignore text that is basically too small. The line count heuristic probably
  // is not worth that much in this case. The inference is too tenuous.
  if (line_count < 3) {
    return 0;
  }

  const text_per_line = (text_length / line_count) | 0;
  // console.debug(text_length, line_count, text_per_line);
  element.setAttribute('text-per-line', text_per_line);

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

// Returns an approximate count of the number of lines in a block of text
function count_text_lines(element) {
  // Special handling for preformatted text
  let newline_count = 0;
  if (['pre', 'code'].includes(element.localName)) {
    const lines = element.textContent.split('\n');
    newline_count = lines.length;
  }

  // Use the number of descendant flow-breaking elements as an estimate of
  // line length.
  // TODO: make this more exhaustive, look for typical flow-breaking elements,
  // maybe consider any other container-type block. In fact maybe instead of
  // line count I should be looking at text-to-child-blocks ratio.
  const splitters = ['br', 'p', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'];
  const selector = splitters.join(',');
  const elements = element.querySelectorAll(splitters);
  let line_count = elements.length;
  line_count += newline_count;

  // Always count the first line as a line
  if (line_count === 0) {
    line_count = 1;
  }

  return line_count;
}

function derive_anchor_density_bias(element) {
  // Indicate no bias on anchors themselves
  if (element.localName === 'a') {
    return 0;
  }

  const anchor_length = derive_anchor_length(element);

  // Do not bias when there is no anchor text
  if (!anchor_length) {
    return 0;
  }

  // This includes the characters that were within anchors together with those
  // not in anchors.
  const text_length = get_text_length(element.textContent);
  const ratio = anchor_length / text_length;

  // These are the deltas from the baseline of 50. Negative means it is that
  // much more likely to be boilerplate. Positive means less likely to be
  // boilerplate. These are hand-crafted and might be poor estimations
  if (ratio > 0.9) {
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

// Find the count of characters in anchors that are anywhere in the
// descendant hierarchy of this element. This assumes anchors do not contain
// each other (e.g. not misnested).
function derive_anchor_length(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for (const anchor of anchors) {
    const text_length = get_text_length(anchor.textContent);
    anchor_length += text_length;
  }
  return anchor_length;
}

function derive_element_type_bias(element) {
  const bias = type_bias_map[element.localName];
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

  let bias = pcount * 2;
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
    return -20;
  } else {
    return 0;
  }
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

const token_weights = {
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
  footer: -20,
  gutter: -30,
  headline: -10,
  keywords: -10,
  left: -20,
  links: -10,
  main: 30,
  meta: -30,
  metadata: -10,
  more: -15,
  nav: -30,
  navbar: -30,
  newsarticle: 50,
  newsletter: -20,
  page: 10,
  popular: -30,
  post: 5,
  promo: -50,
  rail: -50,
  recirculation: -20,
  recommend: -10,
  recommended: -10,
  rel: -50,
  relate: -50,
  related: -50,
  right: -50,
  side: -5,
  sidebar: -20,
  sign: -10,
  signup: -30,
  social: -30,
  story: 50,
  storytxt: 50,
  stub: -10,
  subscription: -20,
  tag: -15,
  tags: -20,
  thread: -10,
  tool: -30,
  tools: -30,
  trend: -5,
  trending: -10,
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

// TODO: decouple from string module, even though this re-uses one function, it
// would be beneficial to be standalone
