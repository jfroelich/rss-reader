import assert from '/src/lib/assert.js';

// Sets the url as the base url of the document, such that document.baseURI will reflect the url. If
// overwrite is true then this ignores existing base elements in the document.
export default function setBaseURI(doc, url, overwrite) {
  assert(doc instanceof Document);
  assert(url instanceof URL);

  if (url.href.startsWith('chrome-extension')) {
    throw new Error(`Refusing to set baseURI to extension url ${url.href}`);
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
      // Insert the base as the first or only element within head
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = doc.createElement('head');
      // Appending to new head while it is still detached is better performance in case document is
      // live
      head.append(base);
      // Insert the head before the body (fallback to append if body not found)
      doc.documentElement.insertBefore(head, body);
    }

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
      head.append(base);
      doc.documentElement.insertBefore(head, body);
    }

    return;
  }

  // The spec states that "[t]he href content attribute, if specified, must contain a valid URL
  // potentially surrounded by spaces." Rather than explicitly trim, we pass along extraneous
  // whitespace to the URL constructor, which tolerates it. So long as we pass the base parameter
  // to the URL constructor, the URL constructor also tolerates when the first
  // parameter is null or undefined.
  const hrefValue = base.getAttribute('href');
  const canonicalURL = new URL(hrefValue, url);

  const comparableHref = hrefValue ? hrefValue.trim() : '';
  if (canonicalURL.href !== comparableHref) {
    // Canonicalization resulted in a material value change. The value change could be as simple as
    // removing spaces, adding a trailing slash, or as complex as making a relative base url
    // absolute with respect to the input url, or turning an empty value into a full url. So we
    // update this first base.
    base.setAttribute('href', canonicalURL.href);
  } else {
    // If there was no material change to the value after canonicalization, this means the existing
    // base href value is canonical. Since we are not overwriting at this point, we respect the
    // existing value. Fallthrough.
  }

  // Per the spec, "[t]here must be no more than one base element per document." Now that we know
  // which of the existing base elements will be retained, we remove the others to make the document
  // more spec compliant.
  const bases = doc.querySelectorAll('base');
  for (const otherBase of bases) {
    if (otherBase !== base) {
      otherBase.remove();
    }
  }
}
