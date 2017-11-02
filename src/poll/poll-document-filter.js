'use strict';

// import base/errors.js
// import filters/adoption-agency-filter.js
// import filters/attribute-filter.js
// import filters/base-filter.js
// import filters/blacklist-filter.js
// import filters/emphasis-filter.js
// import filters/ensure-body-filter.js
// import filters/frame-filter.js
// import filters/host-template-filter.js
// import filters/lonestar-filter.js
// import filters/responsive-image-filter.js
// import net/url-utils.js

// Transforms a document's content by removing or changing nods for
// various reasons.
// @param doc {Document} the document to transform
// @param url {String} the canonical url of the document
// @param fetchImageTimeoutMs {Number} optional, the number of milliseconds
// to wait before timing out when fetching an image
async function pollDocumentFilter(doc, url, fetchImageTimeoutMs) {
  console.assert(doc instanceof Document);
  console.assert(URLUtils.isValid(url));

  frameFilter(doc);
  ensureBodyFilter(doc);

  scriptFilter(doc);
  iframeFilter(doc);
  commentFilter(doc);
  baseFilter(doc);

  hiddenFilter(doc);
  noscriptFilter(doc);
  blacklistFilter(doc);
  scriptAnchorFilter(doc);

  // This should occur prior to boilerplateFilter because it has express
  // knowledge of content organization
  hostTemplateFilter(doc, url);

  boilerplateFilter(doc);
  condenseTagnamesFilter(doc);

  const MAX_EMPHASIS_LENGTH = 300;
  emphasisFilter(doc, MAX_EMPHASIS_LENGTH);


  const baseURL = new URL(url);
  canonicalURLFilter(doc, baseURL);

  // This should occur prior to lazyImageFilter
  // This should occur prior to imageSizeFilter
  // Does not matter if before or after canonicalURLFilter
  responsiveImageFilter(doc);

  // This should occur before sourcelessImageFilter
  lazyImageFilter(doc);

  // This should occur before imageSizeFilter
  lonestarFilter(doc, url);

  sourcelessImageFilter(doc);

  // This should occur after canonicalURLFilter
  // This should occur after lonestarFilter
  let allowed_protocols; // defer to defaults

  // TODO: wrap, return RDR_ERR_FETCH or something on error
  // Allow exceptions to bubble (for now)
  await imageSizeFilter(doc, allowed_protocols, fetchImageTimeoutMs);


  invalidAnchorFilter(doc);
  formattingAnchorFilter(doc);
  formFilter(doc);
  brFilter(doc);
  hrFilter(doc);
  formattingFilter(doc);

  adoptionAgencyFilter(doc);
  hairspaceFilter(doc);

  semanticFilter(doc);
  figureFilter(doc);
  containerFilter(doc);

  listFilter(doc);

  const ROW_SCAN_LIMIT = 20;
  tableFilter(doc, ROW_SCAN_LIMIT);

  // Better to call later than earlier to reduce number of text nodes visited
  nodeWhitespaceFilter(doc);

  // This should be called near the end. Most of the other filters are naive
  // in how they leave ancestor elements meaningless or empty, and simply
  // remove. So this is like an additional pass now that several holes have
  // been made.
  leafFilter(doc);

  // Should be called near end because its behavior changes based on
  // what content remains, and is faster with fewer elements
  trimDocumentFilter(doc);

  // Primarily an attribute filter, so it should be caller as late as possible
  // to reduce the number of elements visited
  noreferrerFilter(doc);
  pingFilter(doc);

  // Filter element attributes last because it is so slow and is sped up by
  // processing fewer elements.
  const attributeWhitelist = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  attributeFilter(doc, attributeWhitelist);

  return RDR_OK;
}
