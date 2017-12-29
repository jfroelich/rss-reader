import assert from "/src/common/assert.js";
import adoptionAgencyFilter from "/src/filters/adoption-agency-filter.js";
import attributeFilter from "/src/filters/attribute-whitelist-filter.js";
import baseFilter from "/src/filters/base-filter.js";
import boilerplateFilter from "/src/filters/boilerplate-filter.js";
import brFilter from "/src/filters/br-filter.js";
import canonicalURLFilter from "/src/filters/canonical-url-filter.js";
import commentFilter from "/src/filters/comment-filter.js";
import condenseTagnamesFilter from "/src/filters/condense-tagnames-filter.js";
import containerFilter from "/src/filters/container-filter.js";
import elementBlacklistFilter from "/src/filters/element-blacklist-filter.js";
import emphasisFilter from "/src/filters/emphasis-filter.js";
import emptyAttributeFilter from "/src/filters/empty-attribute-filter.js";
import ensureBodyFilter from "/src/filters/ensure-body-filter.js";
import figureFilter from "/src/filters/figure-filter.js";
import formattingAnchorFilter from "/src/filters/formatting-anchor-filter.js";
import formattingFilter from "/src/filters/formatting-filter.js";
import formFilter from "/src/filters/form-filter.js";
import frameFilter from "/src/filters/frame-filter.js";
import hiddenElementFilter from "/src/filters/hidden-element-filter.js";
import hostTemplateFilter from "/src/filters/host-template-filter.js";
import hrFilter from "/src/filters/hr-filter.js";
import iframeFilter from "/src/filters/iframe-filter.js";
import imageSizeFilter from "/src/filters/image-size-filter.js";
import invalidAnchorFilter from "/src/filters/invalid-anchor-filter.js";
import largeImageAttributeFilter from "/src/filters/large-image-attribute-filter.js";
import lazyImageFilter from "/src/filters/lazy-image-filter.js";
import {leafFilter} from "/src/filters/leaf-filter.js";
import listFilter from "/src/filters/list-filter.js";
import lonestarFilter from "/src/filters/lonestar-filter.js";
import nodeWhitespaceFilter from "/src/filters/node-whitespace-filter.js";
import noreferrerFilter from "/src/filters/noreferrer-filter.js";
import noscriptFilter from "/src/filters/noscript-filter.js";
import pingFilter from "/src/filters/ping-filter.js";
import responsiveImageFilter from "/src/filters/responsive-image-filter.js";
import scriptFilter from "/src/filters/script-filter.js";
import scriptAnchorFilter from "/src/filters/script-anchor-filter.js";
import semanticFilter from "/src/filters/semantic-filter.js";
import smallImageFilter from "/src/filters/small-image-filter.js";
import sourcelessImageFilter from "/src/filters/sourceless-image-filter.js";
import tableFilter from "/src/filters/table-filter.js";
import trimDocumentFilter from "/src/filters/trim-document-filter.js";

// Transforms a document's content by removing or changing nodes for various reasons.
// @param doc {Document} the document to transform
// @param documentURL {URL} the url of the document
// @param fetchImageTimeoutMs {Number} optional, the number of milliseconds to wait before timing
// out when fetching an image
export default async function applyAllFilters(doc, documentURL, fetchImageTimeoutMs) {
  assert(doc instanceof Document);
  assert(documentURL instanceof URL);

  frameFilter(doc);
  ensureBodyFilter(doc);

  scriptFilter(doc);
  iframeFilter(doc);
  commentFilter(doc);
  baseFilter(doc);

  hiddenElementFilter(doc);
  noscriptFilter(doc);
  elementBlacklistFilter(doc);
  scriptAnchorFilter(doc);

  // This should occur prior to boilerplateFilter because it has express knowledge of content
  // organization
  hostTemplateFilter(doc, documentURL);

  // This should occur before filtering attributes because it makes decisions based on attribute
  // values.
  // This should occur after filtering hidden elements
  boilerplateFilter(doc);

  const copyAttributesOnCondense = false;
  condenseTagnamesFilter(doc, copyAttributesOnCondense);

  const MAX_EMPHASIS_LENGTH = 300;
  emphasisFilter(doc, MAX_EMPHASIS_LENGTH);

  canonicalURLFilter(doc, documentURL);

  // This should occur prior to lazyImageFilter
  // This should occur prior to imageSizeFilter
  // Does not matter if before or after canonicalURLFilter
  responsiveImageFilter(doc);

  // This should occur before sourcelessImageFilter
  lazyImageFilter(doc);

  // This should occur before imageSizeFilter
  lonestarFilter(doc, documentURL.href);

  sourcelessImageFilter(doc);

  // This should occur after canonicalURLFilter
  // This should occur after lonestarFilter
  let allowedProtocols; // defer to defaults

  // Allow exceptions to bubble
  await imageSizeFilter(doc, allowedProtocols, fetchImageTimeoutMs);

  smallImageFilter(doc);

  invalidAnchorFilter(doc);
  formattingAnchorFilter(doc);
  formFilter(doc);
  brFilter(doc);
  hrFilter(doc);
  formattingFilter(doc);
  adoptionAgencyFilter(doc);
  semanticFilter(doc);
  figureFilter(doc);
  containerFilter(doc);

  listFilter(doc);

  const ROW_SCAN_LIMIT = 20;
  tableFilter(doc, ROW_SCAN_LIMIT);

  // Better to call later than earlier to reduce number of text nodes visited
  nodeWhitespaceFilter(doc);

  // This should be called near the end. Most of the other filters are naive in how they leave
  // ancestor elements meaningless or empty, and simply remove. So this is like an additional pass
  // now that several holes have been made.
  leafFilter(doc);

  // Should be called near end because its behavior changes based on what content remains, and is
  // faster with fewer elements
  trimDocumentFilter(doc);

  // Primarily an attribute filter, so it should be caller as late as possible to reduce the number
  // of elements visited
  noreferrerFilter(doc);
  pingFilter(doc);

  // Filter attributes last because it is so slow and is sped up by processing fewer elements.
  const attributeWhitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    // Setting width and height explicitly lead to skewed large images in view, so forbid
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };

  largeImageAttributeFilter(doc);

  attributeFilter(doc, attributeWhitelist);

  emptyAttributeFilter(doc);
}
