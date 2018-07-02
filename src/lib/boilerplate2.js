import * as string from '/src/lib/string.js';

// TODO: target known asides: social, related, featured, copyright,
// menu, advertisement, read more, newsletter signup, site search,
// TODO: but reward footnotes!

// TODO: I could separate out the model stuff into a separate thing, then
// this takes a model and a document and scores the document using the model,
// but for now I am going to do it all at once.

// Marks up the elements of a document based on whether the elements are
// boilerplate. There are several attributes added to various elements, along
// with a key attribute named "boilerplate" that ultimately indicates whether
// or not the element contains boilerplate. Note that boilerplate elements may
// contain non-boilerplate, so be wary of pruning.
// @param document {Document} an html document, preferably inert
export function annotate(document) {
  if (!document.body) {
    return;
  }

  // Do the position pass first over all elements
  // TODO: could just change next pass to iterate over all and pass along
  // index to visitor function.
  const tail_size = 0.2;
  const all_elements = document.body.getElementsByTagName('*');
  const num_elements = all_elements.length;
  const front_max = (tail_size * num_elements) | 0;
  for (let i = 0; i < front_max; i++) {
    const element = all_elements[i];
    element.setAttribute('position-info', 'near-start');
  }
  const end_min = num_elements - front_max;
  for (let i = num_elements - 1; i > end_min; i--) {
    const element = all_elements[i];
    element.setAttribute('position-info', 'near-end');
  }

  // Only these elements are analyzed
  const container_element_names = [
    'article', 'aside', 'div', 'dl', 'footer', 'header', 'layer', 'main',
    'mainmenu', 'menu', 'nav', 'ol', 'section', 'table', 'td', 'ul'
  ];

  const selector = container_element_names.join(',');
  const elements = document.body.querySelectorAll(selector);
  for (const element of elements) {
    annotate_element(element);
  }
}

function annotate_element(element) {
  const type_bias = derive_element_type_bias(element);
  element.setAttribute('type-bias', type_bias);

  const anchor_density_bias = derive_anchor_density_bias(element);
  element.setAttribute('anchor-density-bias', anchor_density_bias);

  const form_bias = derive_form_bias(element);
  element.setAttribute('form-bias', form_bias);

  const image_bias = derive_image_bias(element);
  element.setAttribute('image-bias', image_bias);

  const position_bias = derive_position_bias(element);
  element.setAttribute('position-bias', position_bias);

  const attribute_bias = derive_attribute_bias(element);
  element.setAttribute('attribute-bias', attribute_bias);

  const neutral_bias = 50;

  let bias = neutral_bias;
  bias += anchor_density_bias;
  bias += type_bias;
  bias += image_bias;
  bias += form_bias;
  bias += position_bias;
  bias += attribute_bias;

  // Clamp bias in [0..100]
  bias = Math.min(bias, 100);
  bias = Math.max(0, bias);

  element.setAttribute('boilerplate-bias', bias);

  // The closer to 100, the more likely to be content.
  // The closer to 0, the more likely to be boilerplate.

  if (bias > 75) {
    element.setAttribute('boilerplate', 'very-low');
  } else if (bias > 50) {
    element.setAttribute('boilerplate', 'low');
  } else if (bias === 50) {
    element.setAttribute('boilerplate', 'neutral');
  } else if (bias > 25) {
    element.setAttribute('boilerplate', 'high');
  } else {
    element.setAttribute('boilerplate', 'very-high');
  }
}

// TODO: am I supposed to be rewarding large text as probably content?
// Maybe based on length in comparison to total document.body text length?
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

  // TEMP: debugging
  element.setAttribute('anchor-density', ratio.toFixed(2));

  // TODO: if an area has very low anchor-density, it should propagate that
  // reward to proximate content areas, or maybe everything here should just
  // spread

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
  const condensed_text = string.condense_whitespace(trimmed_text);
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
  // NOTE: I chose to include neutrals in the map to be explicit about them,
  // even though they produce the equivalent non-bias, because I prefer to have
  // the opinion be encoded clearly.
  // NOTE: I assume compiler will hoist this map that is invariant to function
  // if this function is deemed hot
  // NOTE: we only care about container-type elements, as in, those elements
  // which may contain other elements, that semantically tend to represent a
  // unit or block of context that should be treated as a whole. We do not care
  // about void elements or elements that contain only text (generally).

  // NOTE: we only bias the element itself here, not its children, because
  // the children will be removed by virtue of the parent being boilerplate
  // most of the time. If the parent is not-boilerplate we still want some
  // children to be removed but those are the containers themselves again in the
  // case of a hierarchical container.

  // We heavily penalize indications of navigation or non-content, and remain
  // relatively neutral or timid on other types
  const type_bias_map = {
    article: 10,
    section: 0,
    layer: 0,
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
    // menuitem is not really a content container we care about, and is
    // subsumed by menu
    menuitem: 0,
    ol: 0
  };

  const bias = type_bias_map[element.localName];
  return bias ? bias : 0;
}

// TODO: not yet tested
// TODO: think about image-in-list stuff, such as related-posts sections
// I think the reasoning here is that if an element looks like it occupies
// a large amount of screen space, it probably is not boilerplate. Boilerplate
// tends to be small. But it is hard to penalize small images accurately. So
// look for large images and do a reward.
// TODO: be less naive about hidden images in a carousel, this sums area from
// all of them at the moment, i think, in some cases, unless those hidden ones
// are first filtered out, but this leads to erroneously large area
// TODO: maybe this should look at ratio to text too, like a total area to text
// length ratio, a kind of nonsensical value, but it could be used in general
// to say that a portion of the content is almost entirely images and no text
// and maybe that says something about boilerplate?

function derive_image_bias(element) {
  const max_width = 2000;
  const max_height = 1500;
  const screen_area_average = 1500 * 2000;

  // This is a conservative approach to calculating total area from nested
  // images

  const images = element.querySelectorAll('img');
  let total_area = 0;
  for (const image of images) {
    if (image.width && image.height) {
      const area =
          Math.min(image.width, max_width) * Math.min(image.height, max_height);
      if (area > 0) {
        total_area += area;
      }
    }
  }

  if (total_area < 1) {
    return 0;
  }

  console.debug('Found area: ', total_area);
  element.setAttribute('image-area', total_area);

  const ratio = total_area / screen_area_average;

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

function derive_position_bias(element) {
  const info = element.getAttribute('position-info');
  if (info === 'near-start' || info === 'near-end') {
    return -15;
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

// TODO: these are now percentages, need to update
const token_weights = {
  ad: -40,
  ads: -40,
  advert: -40,
  article: 30,
  author: -10,
  bio: -20,
  body: 20,
  comment: -40,
  content: 20,
  contentpane: 50,
  copyright: -10,
  credit: -2,
  date: -10,
  footer: -20,
  gutter: -30,
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
  page: 10,
  post: 5,
  promo: -50,
  rail: -50,
  recommend: -10,
  recommended: -10,
  rel: -50,
  relate: -50,
  related: -50,
  right: -50,
  sidebar: -20,
  social: -30,
  story: 50,
  storytxt: 50,
  stub: -10,
  tag: -15,
  tags: -20,
  tool: -30,
  tools: -30,
  widget: -20,
  zone: -20
};

function derive_attribute_bias(element) {
  const vals = [
    element.id, element.name, element.className,
    element.getAttribute('itemprop')
  ];

  // It is not obvious, so note that join implicitly filters undefined values so
  // no need to explicitly check
  const joined_vals = vals.join(' ');
  if (joined_vals.length < 3) {
    return 0;
  }

  // It is actually faster to use one lowercase call on the entire string than
  // normalizing each token, even though the length check could intercept

  const tokens = tokenize(joined_vals.toLowerCase());
  const token_set = [];

  // Inexact, just an upper bound to try and reduce calls
  const max_token_len = 15;

  let bias = 0;
  for (const token of tokens) {
    if (token.length < max_token_len && !token_set.includes(token)) {
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
