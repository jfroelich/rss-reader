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
  // The maximum distance between any anchor in a sequence and the sequence's
  // lowest common ancestor
  const lca_max_distance = 3;
  const anchors = find_pagination_anchors(doc, location, lca_max_distance);
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
function find_pagination_anchors(doc, location, lca_max_distance) {
  const candidates = find_candidate_anchors(doc, location);
  if(!candidates.length)
    return [];

  const sequences = find_anchor_sequences(candidates, lca_max_distance);
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
  if(index === -1)
    throw new TypeError('path missing forward slash');
  return path.substring(0, index);
}

// Create an array of sequences, where each sequence is an array of links,
// where each link in a sequence is within a certain tolerable distance
// from the lowest common ancestor of a sequence.
// Conditions for not a subsequent anchor in sequence:
// * The lowest common ancestor changed
// * Not equidistant from lowest common ancestor
// * Too distant from lowest common ancestor
// TODO: the lca change check may be implicit in the unequal distances
// check, I just have not fully thought it through.
// TODO: maybe store the LCA within each sequence as each sequence's first value
// before returning, as this may help avoid having to find it again later
// TODO: if I am using a max distance to lca, then why not just restrict search
// distance in find_lca and return null when no lca found within distance?
function find_anchor_sequences(anchor_elements, lca_max_distance) {
  const num_anchors = anchor_elements.length;
  if(!num_anchors)
    throw new TypeError('anchor_elements is empty');
  const minlen = 1, maxlen = 51; // exclusive end points
  const seqs = [];
  const maxd = lca_max_distance - 1;
  let a1 = anchor_elements[0], a2 = null;
  let seq = [a1];
  let lca1, lca2;

  for(let i = 1; i < num_anchors; i++) {
    a2 = anchor_elements[i];
    lca2 = find_lca(a1, a2);
    if((lca1 && (lca2.ancestor !== lca1.ancestor)) ||
      (lca2.d1 !== lca2.d2) || (lca2.d1 > maxd)) {
      if(seq.length > minlen && seq.length < maxlen)
        seqs.push(seq);
      seq = [a2];
      a1 = a2;
      lca1 = null;
    } else {
      lca1 = lca2;
      seq.push(a2);
      a1 = a2;
    }
  }

  if(seq.length > minlen && seq.length < maxlen)
    seqs.push(seq);
  return seqs;
}

// Find the lowest common ancestor and then return total path length. Assumes
// node1 does not contain node2, and node2 does not contain node1.
// Adapted from https://stackoverflow.com/questions/3960843
function find_lca(node1, node2) {
  if(node1 === node2)
    throw new TypeError('node1 === node2');
  if(node1.ownerDocument !== node2.ownerDocument)
    throw new TypeError('node1 not in same document as node2');

  const ancestors1 = [];
  for(let node = node1.parentNode; node; node = node.parentNode)
    ancestors1.push(node);
  const ancestors2 = [];
  for(let node = node2.parentNode; node; node = node.parentNode)
    ancestors2.push(node);

  // The +1s are for the immediate parent steps of each node

  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j]) {
        return {
          'ancestor': ancestor1,
          'd1': i + 1,
          'd2': j + 1
        };
      }
    }
  }

  throw new Error('reached unreachable');
}


// Copies the contents of each one of the docs into the doc. Assume
// the doc is the first one
// TODO: maybe it would be better to accept an array and expect the first
// item of the array to be the target document
function merge_docs(doc, docs) {
  throw new Error('Not yet implemented');
}

// Remove all occurrences of the pager container elements from the doc
function remove_pagination_anchors(doc, anchors) {
  throw new Error('Not yet implemented');
}

// Export
this.merge_multipage_document = merge_multipage_document;
this.find_lca = find_lca;
this.find_anchor_sequences = find_anchor_sequences;

} // End file block scope
