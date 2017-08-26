// See license.md
'use strict';

{ // Begin file block scope

// Investigates whether a document is a multi-page document. If the document
// is a single page, the input document is left as is. If the document is a
// multipage document, the other pages are merged into the document. Pagination
// elements are removed.
// @param doc {HTMLDocument} the document
// @param location {String} url of the document
async function merge_multipage_document(doc, location, timeout_ms) {
  // The maximum distance between any two anchors that may form a part of a
  // pagination sequence, as a count of node edge traverse steps
  const max_distance = 4;
  const anchors = find_pagination_anchors(doc, location, max_distance);
  if(!anchors.length)
    return;

  const urls = [];
  for(const anchor of anchors)
    urls.push(anchor.getAttribute('href'));

  let docs;
  try {
    docs = await fetch_docs(urls, timeout_ms);
  } catch(error) {
    // On fetch error, the merge fails
    console.debug(error);
    return;
  }

  merge_docs(doc, docs);
  remove_pagination_anchors(doc, anchors);
}

// Concurrently fetch the array of urls. If any fetch fails then this fails.
// If no failure then this completes whenever the last fetch completes.
function fetch_docs(urls, timeout_ms) {
  const promises = [];
  for(const url of urls) {
    const promise = fetch_and_parse_html(url, timeout_ms);
    promises.push(fetch_promise);
  }
  return Promise.all(promise);
}

async function fetch_and_parse_html(url, timeout_ms) {
  const parser = new DOMParser();
  const response = await fetch_html(url, timeout_ms);
  const text = await response.text();
  return parser.parseFromString(text, 'text/html');
}

// Return a basic object with a property container_element that points to the
// containing element of the pager, and an array of other page urls.
// Maybe something that tracks how pager was found, so it can be found again?
// TODO: guarantee return a defined array
// @param doc {HTMLDocument}
// @param location {String} url location of the document
function find_pagination_anchors(doc, location, max_distance) {
  const candidates = find_candidate_anchors(doc, location);
  if(!candidates.length)
    return [];

  const sequences = find_anchor_sequences(candidates, max_distance);
  if(!sequences.length)
    return [];

  // Filter out sequences? E.g. too short, too long, cumulative distance
  // too great?
  // NOTE: this is where I am stuck on what to do next

  // Look at each sequence, and try to find a sequence that is suitable

  throw new Error('Not yet implemented');

  //return [];
}

// Search for anchors within the ancestor element. Return an array
// of those anchors that may be pagination. Does not return undefined. If no
// candidates found then an empty array is returned. Is not concerned with
// sequence-related criteria for anchors, just the minimal criteria for any
// anchor
function find_candidate_anchors(doc, location) {
  const body_element = doc.body;
  if(!body_element)
    return [];

  const anchors = body_element.getElementsByTagName('a');
  if(!anchors.length)
    return [];

  const candidates = [];
  const location_url = new URL(location);
  for(const anchor of anchors)
    if(is_candidate_anchor(anchor, location_url))
      candidates.push(anchor);
  return candidates;
}

// Return true if the anchor element may be part of a pager sequence
// @param anchor_element {Element} an anchor element
// @param base_url {URL}
function is_candidate_anchor(anchor_element, base_url) {
  // Although the following conditions are generally associative, they are
  // ordered so as to reduce the chance of performing more expensive operations

  if(!anchor_element.firstChild)
    return false;

  const max_text_length = 30;
  const text_content = anchor_element.textContent || '';
  if(text_content.trim().length > max_text_length)
    return false;

  if(is_hidden_element(anchor_element))
    return false;

  const href_url = get_href_url(anchor_element, base_url);
  if(!href_url)
    return false;

  const allowed_protocols = ['https:', 'http:'];
  if(!allowed_protocols.includes(href_url.protocol))
    return false;

  if(href_url.href === base_url.href)
    return false;

  // Check for digits somewhere in the anchor. At least one feature must have
  // digits (or the name like one/two)
  // Check id, class, href filename, href params, text

  return are_similar_urls(base_url, href_url);
}

// Returns the anchor's href attribute value as a URL object, or undefined
function get_href_url(anchor_element, base_url) {
  let href = anchor_element.getAttribute('href');

  // The anchor's href value will eventually be used as the first parameter to
  // new URL, so it is important to avoid passing in an empty string because
  // when calling new URL(empty string, base url), the result is a copy of
  // the base url, not an error.
  if(!href)
    return;
  href = href.trim();
  if(!href)
    return;

  let href_url;
  try {
    href_url = new URL(href, base_url);
  } catch(error) {
    return;
  }
  return href_url;
}

// NOTE: only looks at inline style, assumes document is inert so cannot use
// offset width/height, also inspects parents (up to body), does not run the
// full range of tricks for hiding nodes (e.g occlusion/clipping/out of view)
function is_hidden_element(element) {
  const doc = element.ownerDocument;
  const body = doc.body;
  // Without a body, everything is hidden
  if(!body)
    return true;

  // This avoids infinite loop below, and also is just a shortcut
  if(element === body)
    return false;

  // This avoids infinite loop below, and avoids processing detached anchors
  if(!body.contains(element))
    throw new TypeError('element is not a descendant of body');

  // Get a list of parents of the element up to but excluding body
  // Including the input element itself. List is ordered from input node up to
  // highest node under body.
  const ancestors = [];
  let node = element;

  while(node !== body) {
    ancestors.push(node);
    node = node.parentNode;
  }

  // Now we want to traverse from the top down, and stop upon finding the
  // first node that is hidden. Rather than use unshift to build the parent
  // array in reverse, we just iterate in reverse.
  const num_ancestors = ancestors.length;
  for(let i = num_ancestors - 1; i > -1; i--) {
    const ancestor = ancestors[i];
    const style = ancestor.style;
    if(style.display === 'none')
      return true;
    if(style.visibility === 'hidden')
      return true;
    if(parseInt(style.opacity) < 0.3)
      return true;
  }
  return false;
}

// Expects 2 URL objects. Return true if the second is similar to the first
function are_similar_urls(url1, url2) {

  // Once url strings are unmarshalled, properties yield normalized values.
  // Therefore there is no need to worry about case.

  // Cross origin links are never similar
  if(url1.origin !== url2.origin)
    return false;

  let path1 = url1.pathname;
  let path2 = url2.pathname;

  // I believe that even for an empty pathname, the path is initialized to
  // a forward slash. So paths should never be empty.
  console.assert(path1, 'path1 empty');
  console.assert(path2, 'path2 empty');

  // Fast case. If both paths equal then similar.
  if(path1 === path2)
    return true;

  path1 = get_partial_path(url1.pathname);
  path2 = get_partial_path(url2.pathname);
  return path1 === path2;
}

// Returns a path string without the "filename" segment of the path
// Note that for basic path like '/' this may return an empty string.
// Assume's input path string is defined, trimmed, and normalized.
function get_partial_path(path) {
  const index = path.lastIndexOf('/');

  // All paths must have a forward slash somewhere. It may only be the
  // starting slash, but at least one exists. It is more appropriate to error
  // out here because this means the function was called incorrectly. Also want
  // to avoid calling substring with a negative second parameter.
  if(index === -1)
    throw new TypeError('path missing forward slash');

  const part = path.substring(0, index);
  return part;
}

// Create an array of sequences, where each sequence is an array of links,
// where each link in a sequence is within a certain tolerable "distance"
// from the other links in the sequence. More specifically, in an a-b-c
// relation, a is within a certain threshold of b, and b is within a threshold
// of c.
// TODO: limit sequence member count?
function find_anchor_sequences(anchor_elements, max_distance) {
  const num_anchors = anchor_elements.length;
  if(!num_anchors)
    throw new TypeError('anchor_elements is empty');
  if(max_distance < 2)
    throw new TypeError('max_distance < 2');

  const sequences = [];
  const min_sequence_length = 1;
  const max_distance_minus1 = max_distance - 1;
  let prev_a = anchor_elements[0];
  let sequence = [prev_a];

  for(let i = 1; i < num_anchors; i++) {
    const a = anchor_elements[i];
    const distance = calc_node_distance(prev_a, a);
    if(distance > max_distance_minus1) {
      if(sequence.length > min_sequence_length)
        sequences.push(sequence);
      sequence = [];
    }

    sequence.push(a);
    prev_a = a;
  }

  // Do not forget the remaining sequence
  if(sequence.length > min_sequence_length)
    sequences.push(sequence);

  return sequences;
}

// Find the lowest common ancestor and then return total path length. Assumes
// node1 does not contain node2, and node2 does not contain node1.
// Adapted from https://stackoverflow.com/questions/3960843
function calc_node_distance(node1, node2) {
  if(node1 === node2)
    throw new Error('node1 === node2, not allowed');
  if(node1.ownerDocument !== node2.ownerDocument)
    throw new Error('node1 and node2 are not from same document');

  const ancestors1 = [];
  for(let node = node1.parentNode; node; node = node.parentNode)
    ancestors1.push(node);
  const ancestors2 = [];
  for(let node = node2.parentNode; node; node = node.parentNode)
    ancestors2.push(node);

  const immediate_parent_lengths = 2;
  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j])
        return i + j + immediate_parent_lengths;
    }
  }

  throw new Error('reached unreachable');
}


// Copies the contents of each one of the docs into the doc. Assume
// the doc is the first one
function merge_docs(doc, docs) {
  throw new Error('Not yet implemented');
}

// Remove all occurrences of the pager container elements from the doc
function remove_pagination_anchors(doc, pager) {
  throw new Error('Not yet implemented');
}

// Export
this.merge_multipage_document = merge_multipage_document;
this.calc_node_distance = calc_node_distance;
this.find_anchor_sequences = find_anchor_sequences;

} // End file block scope
