import assert from '/src/lib/assert.js';

// TODO: consider some kind of overwrite parameter, boolean, to enable the
// caller to indicate that existing base information should be replaced instead
// of respected.

// Set the baseURI property of a document. baseURI is readonly. However, its
// value is derived from base elements, which are manipulable. Therefore baseURI
// is indirectly manipulable by manipulating base elements. Note that this is a
// brittle solution because doing other document manipulation that affects base
// elements or attributes can have unintended side effects.
//
// Due to the prohibitive cost of copying document objects, the document input
// is modified in place rather than treated as immutable.
//
// If the document already has a valid base uri, it is left as is.
export function set_base_uri(document, url, overwrite) {
  assert(typeof document === 'object');
  assert(typeof url === 'object');
  assert(url.href);

  if (overwrite) {
    const base = document.createElement('base');
    base.setAttribute('href', url.href);
    let head = document.querySelector('head');
    if (head) {
      head.insertBefore(base, head.firstChildElement);
    } else {
      head = document.createElement('head');
      head.appendChild(base);
      document.documentElement.appendChild(head);
    }
    return;
  }


  // TODO: this matches the first base with an href, which may not be the first
  // base. I am not sure if that is correct.

  // According to MDN: "If multiple <base> elements are specified, only the
  // first href and first target value are used; all others are ignored."
  // We begin by searching for the first existing base element. We use
  // querySelector which matches in document order. If we find a suitable
  // element, grab its href value and resolve it relative to the input url.
  // If the href was absolute, it will retain its original origin and ignore the
  // custom url.

  let href_value;
  let canonical_base_url;
  let base_element = document.querySelector('base[href]');
  if (base_element) {
    href_value = base_element.getAttribute('href');
    if (href_value) {
      href_value = href_value.trim();
      if (href_value) {
        canonical_base_url = new URL(href_value, url);
      }
    }
  }

  if (canonical_base_url) {
    if (canonical_base_url.href !== href_value) {
      // The document came with a base element but its href value was either
      // relative or in some way not canonical (e.g. whitespace, trailing
      // slash). Overwrite the value. Leave the first base element in place,
      // and assume the browser will consider it as the source of baseURI.
      base_element.setAttribute('href', canonical_base_url.href);
      return;
    } else {
      // The document came with a base element with a canonical url. Leave the
      // first base element in place, and assume the browser will use it to
      // determine baseURI.
      return;
    }
  }

  // TODO: I think it would be more accurate to only adjust the first base
  // element, or create one, rather than doing this suprising side effect.
  // Mutating other base elements seems to go outside the terms of our API
  // contract. Unexpected behavior is bad.

  // If we failed to find a canonical base url, let's create our own base.
  // For safety, just clean up any existing ones. This is less brittle than
  // trying to rely on the 'first-base' rule, although it is does mean that this
  // mutation has unexpected side effects (of having other base elements
  // modified).
  const base_elements = document.querySelectorAll('base');
  for (const old_base_element of base_elements) {
    old_base_element.remove();
  }

  base_element = document.createElement('base');
  base_element.setAttribute('href', url.href);

  // In order to append to the head element, we have to find the head element.
  // document.head is defined for html documents but undefined for xml flagged
  // documents. querySelector works in both cases. This function exists in a
  // module designed for html documents, but it is nice to support xml for not
  // much of a cost. Also note that I prefer to try and shove the base element
  // into the correct spot, even if that means producing this unexpected side
  // effect of generating a head element as well.

  // NOTE: it would technically be better for performance to append the base to
  // the head before appending the head, in the event this is called on a live
  // document. But this is currently designed with the assumption this document
  // is inert, so the different order of operations does not matter. Also note
  // that I assume most documents have a head, and that out-of-body dom
  // mutations may have minimized impacts on rendering, so this concern seems
  // trivial.

  let head_element = document.querySelector('head');
  if (!head_element) {
    head_element = document.createElement('head');
    document.documentElement.appendChild(head_element);
  }

  // We removed all the other bases, just append as last element without any
  // anxiety over any 'early in document order' conflicting bases
  head_element.appendChild(base_element);
}
