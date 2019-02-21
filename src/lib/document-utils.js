import {assert} from '/src/lib/assert.js';

// TODO: maybe it is better to check for base as a required element because
// this avoids the ambiguity with chrome-extension default being implicit or
// explicit? checking for explicit base would guarantee the baseURI is explicit,
// in fact that might be the only way. false negative when all urls absolute
// however, but maybe that is immaterial.
// TODO: I really do not like the chrome-extension check, except that, that is
// exactly the url i want to avoid in the particular use case. it feels like
// the function is incorrectly targeted, it is written and named as to be
// general application but I have a specific and particular situation in mind.
export function has_valid_base_uri(doc) {
  return doc instanceof Document && doc.baseURI &&
      typeof doc.baseURI === 'string' &&
      !doc.baseURI.startsWith('chrome-extension');
}

export function set_base_uri(doc, url, overwrite) {
  assert(doc instanceof Document);
  assert(url instanceof URL);

  if (url.href.startsWith('chrome-extension')) {
    throw new Error('Refusing to set baseURI to extension url ' + url.href);
  }

  let head = doc.querySelector('head');
  const body = doc.querySelector('body');

  if (overwrite) {
    // There must be no more than one base element per document.
    const bases = doc.querySelectorAll('base');
    for (const base of bases) {
      base.remove();
    }

    const base = doc.createElement('base');
    base.setAttribute('href', url.href);

    if (head) {
      // Insert the base as the first element within head. If firstElementChild
      // is undefined, this devolves into appendChild.
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = doc.createElement('head');
      // Appending to new head while it is still detached is better performance
      // in case document is live
      head.appendChild(base);
      // Insert the head before the body (fallback to append if body not found)
      doc.documentElement.insertBefore(head, body);
    }

    assert(has_valid_base_uri(doc));
    return;
  }

  let base = doc.querySelector('base[href]');
  if (!base) {
    base = doc.createElement('base');
    base.setAttribute('href', url.href);
    if (head) {
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = doc.createElement('head');
      head.appendChild(base);
      doc.documentElement.insertBefore(head, body);
    }

    assert(has_valid_base_uri(doc));
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
    // Fallthrough
  }

  // Per the spec, "[t]here must be no more than one base element per
  // document." Now that we know which of the existing base elements will be
  // retained, we remove the others to make the document more spec compliant.
  const bases = doc.querySelectorAll('base');
  for (const other_base of bases) {
    if (other_base !== base) {
      other_base.remove();
    }
  }

  assert(has_valid_base_uri(doc));
}
