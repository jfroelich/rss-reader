// See license.md
'use strict';

{ // Begin file block scope

// Investigates whether a document is a multi-page document. If the document
// is a single page, the input document is left as is. If the document is a
// multipage document, the other pages are merged into the document. Pagination
// elements are removed.
async function merge_multipage_document(html_document, url_string,
  per_fetch_timeout_ms) {
  const pager = find_pager(html_document, url_string);
  if(!pager)
    return;

  const docs = await fetch_docs(pager.urls, per_fetch_timeout_ms);
  merge_docs(html_document, docs);
  remove_pager_elements(html_document, pager);
}

function fetch_docs(urls, timeout_ms) {
  const fetch_promises = [];
  for(const url of urls) {
    const fetch_promise = fetch_html_silently(url, timeout_ms);
    fetch_promises.push(fetch_promise);
  }
  return Promise.all(fetch_promises);
}

// Traps errors so that fetch does not fail fast when used with Promise.all
async function fetch_html_silently(url, timeout_ms) {
  const parser = new DOMParser();
  try {
    const response = await fetch_html(url, timeout_ms);
    const text = await response.text();

    const html_document = parser.parseFromString(text, 'text/html');
    return html_document;
  } catch(error) {
    console.debug(error);
  }
}

// Return a basic object with a property container_element that points to the
// containing element of the pager, and an array of other page urls.
// Maybe something that tracks how pager was found, so it can be found again?
function find_pager(html_document, initial_url_string) {
  const body_element = html_document.body;
  if(!body_element)
    return;

  // 1. Get all anchors
  let anchor_elements = body_element.getElementsByTagName('a');
  if(!anchor_elements.length)
    return;

  // 2. Filter out anchors that are unlikely candidates
  anchor_elements = filter_candidate_anchors(anchor_elements,
    initial_url_string);
  if(!anchor_elements.length)
    return;

  // 3. Find sequences of anchor elements
  const max_distance = 4;
  const sequences = find_anchor_sequences(anchor_elements, max_distance);
  if(!sequences.length)
    return;

  // Filter out sequences? E.g. too short, too long, cumulative distance
  // too great?
  // NOTE: this is where I am stuck on what to do next

  // 4. Find a good sequence and return it.
  throw new Error('Not yet implemented');

}

// Returns a new array of anchors that may be useful for sequence analysis
// e.g. similar to initial url (except for file name), on same domain
function filter_candidate_anchors(anchor_elements, initial_url_string) {
  const candidates = [];
  const initial_url_object = new URL(initial_url_string);
  for(const anchor_element of anchor_elements)
    if(is_candidate_anchor(anchor_element, initial_url_object))
      candidates.push(anchor_element);
  return candidates;
}

// Return true if the anchor element may be part of a pager sequence
function is_candidate_anchor(anchor_element, initial_url_object) {
  const href = anchor_element.getAttribute('href');

  // The anchor's href value will eventually be used as the first parameter to
  // new URL, so it is important to avoid passing in an empty string because
  // when calling new URL(empty string, base url), the result is a copy of
  // the base url, not an error. This is also cheaper.
  if(!href)
    return false;
  const trimmed_href = href.trim();
  if(!trimmed_href)
    return false;

  // Although this could be tested later, I prefer doing this explicitly and
  // reducing calls to new URL
  if(!/^https?:\/\//i.test(trimmed_href))
    return false;

  // Validate the href url, and resolve the url, and get the object form of
  // the url for inspecting its parts
  let href_url_object;
  try {
    href_url_object = new URL(trimmed_href, initial_url_object);
  } catch(error) {
    return false;
  }

  return are_similar_urls(initial_url_object, href_url_object);
}

// Expects 2 URL objects. Return true if the second is similar to the first
function are_similar_urls(url1, url2) {
  throw new Error('Not yet implemented');

  // NOTE: once url strings are unmarshalled into URL objects, accessing props
  // of the URL object returns normalized strings. Therefore there is no need
  // to worry about case-sensitivity.

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


// Copies the contents of each one of the docs into the html_document. Assume
// the html_document is the first one
function merge_docs(html_document, docs) {
  throw new Error('Not yet implemented');
}

// Remove all occurrences of the pager container elements from the html_document
function remove_pager_elements(html_document, pager) {
  throw new Error('Not yet implemented');
}

// Export
this.merge_multipage_document = merge_multipage_document;
this.calc_node_distance = calc_node_distance;
this.find_anchor_sequences = find_anchor_sequences;

} // End file block scope
