import findLCA from "/src/experimental/lca.js";
import {isHiddenElement} from "/src/dom/visibility.js";
import assert from "/src/assert.js";

// Returns an array
// TODO: maybe revert to returning an object that abstracts the urls and other
// properties
// TODO: If returning a pager should probably be renamed to something like
// findPager
// TODO: return something that tracks how pager was found, so it can be found again
// for removal. Or ... remove on find, e.g. have a bool param


// @param doc {HTMLDocument}
// @param location {String} url location of the document
function paginationFindAnchors(doc, location, lcaMaxDistance) {
  assert(doc instanceof Document);

  const candidates = paginationFindCandidateAnchors(doc, location);
  if(!candidates.length) {
    return [];
  }

  const sequences = paginationFindAnchorSequences(candidates, lcaMaxDistance);
  if(!sequences.length) {
    return [];
  }

  // TODO: Return the first valid sequence?
  throw new Error('Not yet implemented');
}

// Search for anchors within the ancestor element. Return an array
// of those anchors that may be pagination. Does not return undefined. If no
// candidates found then an empty array is returned. Is not concerned with
// sequence-related criteria for anchors, just the minimal criteria for any
// anchor
function paginationFindCandidateAnchors(doc, location) {
  const bodyElement = doc.body;
  if(!bodyElement) {
    return [];
  }

  const anchors = bodyElement.getElementsByTagName('a');
  if(!anchors.length) {
    return [];
  }

  const candidates = [];
  const locationURL = new URL(location);
  for(const anchor of anchors) {
    if(paginationIsCandidateAnchor(anchor, locationURL)) {
      candidates.push(anchor);
    }
  }
  return candidates;
}

// Return true if the anchor element may be part of a pager sequence
// @param anchorElement {Element} an anchor element
// @param baseURL {URL}
function paginationIsCandidateAnchor(anchorElement, baseURL) {
  // Although the following conditions are generally associative, they are
  // ordered so as to reduce the chance of performing more expensive operations

  if(!anchorElement.firstChild) {
    return false;
  }

  const maxTextLength = 30;
  const textContent = anchorElement.textContent || '';
  if(textContent.trim().length > maxTextLength) {
    return false;
  }

  if(isHiddenElement(anchorElement)) {
    return false;
  }

  const hrefURL = paginationGetHrefURL(anchorElement, baseURL);
  if(!hrefURL) {
    return false;
  }

  const allowedProtocols = ['https:', 'http:'];
  if(!allowedProtocols.includes(hrefURL.protocol)) {
    return false;
  }

  // If it an exactly identical url then ignore it
  if(hrefURL.href === baseURL.href) {
    return false;
  }

  // TODO: Check for digits somewhere in the anchor. At least one feature must
  // have digits (or the name like one/two)
  // TODO: Check id, class, href filename, href params, text
  return paginationAreSimilarURLs(baseURL, hrefURL);
}

// Returns the anchor's href attribute value as a URL object, or undefined
function paginationGetHrefURL(anchorElement, baseURL) {
  assert(baseURL);

  let href = anchorElement.getAttribute('href');

  // The anchor's href value will eventually be used as the first parameter to
  // new URL, so it is important to avoid passing in an empty string because
  // when calling new URL(empty string, base url), the result is a copy of
  // the base url, not an error.
  if(!href) {
    return;
  }

  href = href.trim();
  if(!href) {
    return;
  }

  let hrefURL;
  try {
    hrefURL = new URL(href, baseURL);
  } catch(error) {
  }
  return hrefURL;
}

// TODO: actually I think this can be inlined. Also, this is really just
// comparing path so this name is not great
// Expects 2 URL objects. Return true if the second is similar to the first
function paginationAreSimilarURLs(url1, url2) {
  if(url1.origin !== url2.origin) {
    return false;
  }

  let path1 = url1.pathname, path2 = url2.pathname;
  if(path1 === path2) {
    return true;
  }

  path1 = paginationGetPartialPath(url1.pathname);
  path2 = paginationGetPartialPath(url2.pathname);
  return path1 === path2;
}

// TODO: move to url.js
// Returns a path string without the "filename" segment of the path
// Note that for basic path like '/' this may return an empty string.
// Assume's input path string is defined, trimmed, and normalized.
function paginationGetPartialPath(path) {

  // TODO: assert path starts with / as an ASSERTION, not a basic error

  const index = path.lastIndexOf('/');
  if(index === -1) {
    throw new TypeError('path missing forward slash');
  }

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
// distance in findLCA and return null when no lca found within distance?
function paginationFindAnchorSequences(anchors, lcaMaxDistance) {
  const anchorCount = anchors.length;

  assert(anchorCount > 0);

  const minLength = 1, maxLength = 51; // exclusive end points
  const seqs = [];
  const maxd = lcaMaxDistance - 1;
  let a1 = anchors[0], a2 = null;
  let seq = [a1];
  let lca1, lca2;

  for(let i = 1; i < anchorCount; i++) {
    a2 = anchors[i];
    lca2 = findLCA(a1, a2);
    if((lca1 && (lca2.ancestor !== lca1.ancestor)) ||
      (lca2.d1 !== lca2.d2) || (lca2.d1 > maxd)) {

      if(seq.length > minLength && seq.length < maxLength) {
        seqs.push(seq);
      }

      seq = [a2];
      a1 = a2;
      lca1 = null;
    } else {
      lca1 = lca2;
      seq.push(a2);
      a1 = a2;
    }
  }

  if(seq.length > minLength && seq.length < maxLength) {
    seqs.push(seq);
  }

  return seqs;
}
