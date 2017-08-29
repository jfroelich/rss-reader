// See license.md
'use strict';

{ // Begin file block scope

// Returns an array
// TODO: update notes document
// TODO: maybe revert to returning an object that abstracts the urls and other
// properties
// TODO: something that tracks how pager was found, so it can be found again
// for removal. Or ... remove on find, e.g. have a bool param
// If returning a pager should probably be renamed to something like
// find_pager

// @param doc {HTMLDocument}
// @param location {String} url location of the document
function find_pagination_anchors(doc, location, lca_max_distance) {
  const candidates = find_candidate_anchors(doc, location);
  if(!candidates.length)
    return [];

  const sequences = find_anchor_sequences(candidates, lca_max_distance);
  if(!sequences.length)
    return [];

  // TODO: Return the first valid sequence?
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

  // If it an exactly identical url then ignore it
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
  if(url1.origin !== url2.origin)
    return false;
  let path1 = url1.pathname, path2 = url2.pathname;
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

this.find_pagination_anchors = find_pagination_anchors;
this.find_lca = find_lca;
this.find_anchor_sequences = find_anchor_sequences;

} // End file block scope
