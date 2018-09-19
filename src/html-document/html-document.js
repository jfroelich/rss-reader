// TODO: this is too general of a module name. rename the module to base-uri
// so as to properly represent that this module is specific to dealing with
// base uris.

import assert from '/src/assert/assert.js';

// Set the baseURI property of a document. baseURI is readonly. However, its
// value is derived from base elements, which are manipulable. Therefore baseURI
// is indirectly manipulable by manipulating base elements. Note that this is a
// brittle solution because doing other document manipulation that affects base
// elements or attributes can have unintended side effects.
//
// Note this imposes a canonical requirement. After this operation the document
// will have a canonical base url that is standalone, free of dependency on any
// kind of inherited/substituted base url that comes from somewhere else.
//
// Spec information:
// https://html.spec.whatwg.org/multipage/semantics.html#the-base-element
//
// @param document {Document} the document to modify. Due to the prohibitive
// cost of copying document objects, the document input is modified in place
// rather than treated as immutable.
// @param url {URL} the desired base url to use, which depending on params
// and the document, will either be ignored, merged with existing base, or will
// replace the existing base.
// @param overwrite {Boolean} if true, then existing bases are ignored, and the
// base uri is set to the input url. If false, then existing bases are
// respected. Defaults to false. Note that in both cases, all bases other than
// the intended base element are implicitly removed.
// @return {void}
export function set_base_uri(document, url, overwrite) {
  assert(typeof document === 'object');
  assert(typeof url === 'object');
  assert(url.href);

  // SECURITY: this implementation uses createElement. This creates the element
  // as owned by the input document, which should not be the same document as
  // the document running this script.

  // If we will be creating a new base element, we want to place it correctly
  // in the dom hierarchy, under the head element, so we will need to find the
  // head element.  Use querySelector rather than document.head to retrieve the
  // head element so as to also support implicitly xml-flagged documents (where
  // document.head is undefined).
  let head = document.querySelector('head');

  // If the head element doesn't exist, we will be creating it, and will want to
  // insert it before the body element.
  const body = document.querySelector('body');

  if (overwrite) {
    // Per the spec, "[t]here must be no more than one base element per
    // document." We plan to add one that overwrites anything that exists, and
    // do not care about the target attribute, so just remove everything else.
    const bases = document.querySelectorAll('base');
    for (const base of bases) {
      base.remove();
    }

    const base = document.createElement('base');
    base.setAttribute('href', url.href);

    if (head) {
      // Insert the base as the first element within head. If firstElementChild
      // is undefined, this seamlessly turns into an appendChild operation.
      head.insertBefore(base, head.firstElementChild);
    } else {
      // SECURITY: this creates the element as owned by the input document,
      // which should not be the same document as the document running this
      // script.
      head = document.createElement('head');
      // Appending to new head while it is still detached is better performance
      // in case document is live
      head.appendChild(base);
      // Insert the head before the body (fallback to append if body not found)
      document.documentElement.insertBefore(head, body);
    }
    return;
  }

  let base = find_first_base(document);

  // If we struck out trying to get on base, our job is easier.
  if (!base) {
    base = document.createElement('base');
    base.setAttribute('href', url.href);
    if (head) {
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = document.createElement('head');
      head.appendChild(base);
      document.documentElement.insertBefore(head, body);
    }
    return;
  }

  // The spec states that "[t]he href content attribute, if specified, must
  // contain a valid URL potentially surrounded by spaces." Rather than
  // explicitly trim, we pass along extraneous whitespace to the URL
  // constructor, which tolerates it. So long as we pass the base parameter
  // to the URL constructor, the URL constructor also tolerates when the first
  // parameter is null or undefined.
  const href_value = base.getAttribute('href');
  const canonical_url = new URL(href_value, url);

  const comparable_href = href_value ? href_value.trim() : '';
  if (canonical_url.href !== comparable_href) {
    // Canonicalization resulted in a material value change. The value change
    // could be as simple as removing spaces, adding a trailing slash, or as
    // complex as making a relative base url absolute with respect to the input
    // url, or turning an empty value into a full url. So we update this first
    // base.
    base.setAttribute('href', canonical_url.href);
  } else {
    // If there was no material change to the value after canonicalization, this
    // means the existing base href value is canonical. Since we are not
    // overwriting at this point, we respect the existing value.
  }

  // Per the spec, "[t]here must be no more than one base element per
  // document." Now that we know which of the existing base elements will be
  // retained, we remove the others to make the document more spec compliant.
  const bases = document.querySelectorAll('base');
  for (const other_base of bases) {
    if (other_base !== base) {
      other_base.remove();
    }
  }
}

// Find the first existing base element in document traversal order. Skip over
// bases that are missing an href. Per the spec, "[a] base element must have
// either an href attribute, a target attribute, or both." I assume this means
// that browsers ignore base elements that are missing such attributes. Also,
// we do not care about the target attribute. We want to match browser
// behavior here for security reasons, and to meet expectations.
//
// The search is not restricted to head so as to still match when the page
// author misplaced the element, because I think this relaxed approach better
// matches browser behavior than a strict one that only looks in the proper
// location (under head). It is preferable to recognize a document's base url
// in the same way that the browser would than miss it and substitute in our
// own. Authors using relative base urls design pages to work in browsers, so
// if we miss the base url, we could end up setting the wrong base.
//
// Note that I am not that strict about href validity, so this departs from
// spec which states that "[t]he href content attribute, if specified, must
// contain a valid URL potentially surrounded by spaces." Here we just look
// for attribute presence. I assume that is good enough.
//
// I try to use the native selector instead of an explicit tree walk because
// the native selector is substantially faster. The tradeoff is that I lose
// the ability to find only href attributes with valid values.
//
// TODO: consider revising to actually find the first base with a valid url, and
// not merely the first base with an href attribute.
function find_first_base(document) {
  return document.querySelector('base[href]');
}
