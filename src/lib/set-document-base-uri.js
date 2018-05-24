// Set the baseURI property of a document
export function set_document_base_uri(document, document_url) {
  if (!document_url || !document_url.href) {
    throw new TypeError('document_url is not an URL');
  }

  // document.baseURI is readonly. However, it is derived from base elements,
  // and therefore is indirectly manipulatable.

  // We could blindly ignore the base elements, but this tries to respect it
  // a little bit. If the author set a custom canonical base url, try and use
  // it.

  // The baseURI property is determined according to the presence of any base
  // elements. Look for an existing base element.
  // According to MDN: "If multiple <base> elements are specified, only the
  // first href and first target value are used; all others are ignored."
  // So we use querySelector which matches in document order.

  let href_value;
  let canonical_base_url;
  let base_element = document.querySelector('base[href]');
  if (base_element) {
    href_value = base_element.getAttribute('href');
    if (href_value) {
      href_value = href_value.trim();
      if (href_value) {
        canonical_base_url = new URL(href_value, document_url);
      }
    }
  }

  if (canonical_base_url) {
    if (canonical_base_url.href !== href_value) {
      // The document came with a base element but its href value was either
      // relative or in some way not canonical (e.g. whitespace or whatever).
      // Overwrite the value.

      base_element.setAttribute('href', canonical_base_url.href);
      // And now we are done
      return;
    } else {
      // The document came with a base element with a canonical url. Leave it
      // as is.
      return;
    }
  }

  // If we failed to find a canonical base url, let's create our own.
  // For safety, just clean up any existing ones.
  const base_elements = document.querySelectorAll('base');
  for (const old_base_element of base_elements) {
    old_base_element.remove();
  }

  base_element = document.createElement('base');
  base_element.setAttribute('href', document_url.href);

  // In order to append we have to find head. document.head is undefined for
  // implicitly xml flagged documents, but querySelector still works.
  let head_element = document.querySelector('head');
  if (!head_element) {
    head_element = document.createElement('head');
    document.documentElement.appendChild(head_element);
  }

  // We removed all the other bases, just append as last element without any
  // anxiety over any 'early in document order' conflicting bases
  head_element.appendChild(base_element);
}
