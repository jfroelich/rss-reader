import assert from "/src/common/assert.js";
import adoptionAgencyFilter from "/src/feed-poll/filters/adoption-agency-filter.js";
import attributeFilter from "/src/feed-poll/filters/attribute-whitelist-filter.js";
import * as BasicFilters from "/src/feed-poll/filters/basic-filters.js";
import boilerplateFilter from "/src/feed-poll/filters/boilerplate-filter.js";
import canonicalURLFilter from "/src/feed-poll/filters/canonical-url-filter.js";
import condenseTagnamesFilter from "/src/feed-poll/filters/condense-tagnames-filter.js";
import elementBlacklistFilter from "/src/feed-poll/filters/element-blacklist-filter.js";
import emptyAttributeFilter from "/src/feed-poll/filters/empty-attribute-filter.js";
import formattingAnchorFilter from "/src/feed-poll/filters/formatting-anchor-filter.js";
import formattingFilter from "/src/feed-poll/filters/formatting-filter.js";
import formFilter from "/src/feed-poll/filters/form-filter.js";
import frameFilter from "/src/feed-poll/filters/frame-filter.js";
import hiddenElementFilter from "/src/feed-poll/filters/hidden-element-filter.js";
import hostTemplateFilter from "/src/feed-poll/filters/host-template-filter.js";
import hrFilter from "/src/feed-poll/filters/hr-filter.js";
import iframeFilter from "/src/feed-poll/filters/iframe-filter.js";
import imageSizeFilter from "/src/feed-poll/filters/image-size-filter.js";
import invalidAnchorFilter from "/src/feed-poll/filters/invalid-anchor-filter.js";
import largeImageAttributeFilter from "/src/feed-poll/filters/large-image-attribute-filter.js";
import lazyImageFilter from "/src/feed-poll/filters/lazy-image-filter.js";
import {leafFilter} from "/src/feed-poll/filters/leaf-filter.js";
import listFilter from "/src/feed-poll/filters/list-filter.js";
import lonestarFilter from "/src/feed-poll/filters/lonestar-filter.js";
import nodeWhitespaceFilter from "/src/feed-poll/filters/node-whitespace-filter.js";
import noreferrerFilter from "/src/feed-poll/filters/noreferrer-filter.js";
import noscriptFilter from "/src/feed-poll/filters/noscript-filter.js";
import pingFilter from "/src/feed-poll/filters/ping-filter.js";
import responsiveImageFilter from "/src/feed-poll/filters/responsive-image-filter.js";
import scriptFilter from "/src/feed-poll/filters/script-filter.js";
import scriptAnchorFilter from "/src/feed-poll/filters/script-anchor-filter.js";
import semanticFilter from "/src/feed-poll/filters/semantic-filter.js";
import smallImageFilter from "/src/feed-poll/filters/small-image-filter.js";
import sourcelessImageFilter from "/src/feed-poll/filters/sourceless-image-filter.js";
import tableFilter from "/src/feed-poll/filters/table-filter.js";
import trimDocumentFilter from "/src/feed-poll/filters/trim-document-filter.js";

// TODO: create a new filter that filters out small font text

// Transforms a document's content by removing or changing nodes for various reasons.
// @param document {Document} the document to transform
// @param documentURL {URL} the url of the document
// @param fetchImageTimeoutMs {Number} optional, the number of milliseconds to wait before timing
// out when fetching an image
export default async function applyAllFilters(document, documentURL, fetchImageTimeoutMs) {
  assert(document instanceof Document);
  assert(documentURL instanceof URL);

  frameFilter(document);

  BasicFilters.ensureDocumentHasBodyElement(document);

  scriptFilter(document);
  iframeFilter(document);
  BasicFilters.filterCommentNodes(document);
  BasicFilters.filterBaseElements(document);

  hiddenElementFilter(document);
  noscriptFilter(document);
  elementBlacklistFilter(document);
  scriptAnchorFilter(document);

  // This should occur prior to boilerplateFilter because it has express knowledge of content
  // organization
  hostTemplateFilter(document, documentURL);

  // This should occur before filtering attributes because it makes decisions based on attribute
  // values.
  // This should occur after filtering hidden elements
  boilerplateFilter(document);

  const copyAttributesOnCondense = false;
  condenseTagnamesFilter(document, copyAttributesOnCondense);

  const maxEmphasisTextLength = 200;
  BasicFilters.filterEmphasis(document, maxEmphasisTextLength);

  canonicalURLFilter(document, documentURL);

  // This should occur prior to lazyImageFilter
  // This should occur prior to imageSizeFilter
  // Does not matter if before or after canonicalURLFilter
  responsiveImageFilter(document);

  // This should occur before sourcelessImageFilter
  lazyImageFilter(document);

  // This should occur before imageSizeFilter
  lonestarFilter(document, documentURL.href);

  sourcelessImageFilter(document);

  // This should occur after resolving urls
  // This should occur after removing telemetry
  // Allow exceptions to bubble
  let allowedProtocols; // defer to defaults
  await imageSizeFilter(document, allowedProtocols, fetchImageTimeoutMs);

  smallImageFilter(document);

  invalidAnchorFilter(document);
  formattingAnchorFilter(document);
  formFilter(document);

  BasicFilters.filterBRElements(document);

  hrFilter(document);
  formattingFilter(document);
  adoptionAgencyFilter(document);
  semanticFilter(document);
  BasicFilters.filterFigureElements(document);
  BasicFilters.filterContainerElements(document);

  listFilter(document);

  const rowScanLimit = 20;
  tableFilter(document, rowScanLimit);

  // Better to call later than earlier to reduce number of text nodes visited
  nodeWhitespaceFilter(document);

  // This should be called near the end. Most of the other filters are naive in how they leave
  // ancestor elements meaningless or empty, and simply remove. So this is like an additional pass
  // now that several holes have been made.
  leafFilter(document);

  // Should be called near end because its behavior changes based on what content remains, and is
  // faster with fewer elements
  trimDocumentFilter(document);

  // Primarily an attribute filter, so it should be caller as late as possible to reduce the number
  // of elements visited
  noreferrerFilter(document);
  pingFilter(document);

  // Filter attributes last because it is so slow and is sped up by processing fewer elements.
  const attributeWhitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    // Setting width and height explicitly lead to skewed large images in view, so forbid
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };

  largeImageAttributeFilter(document);

  attributeFilter(document, attributeWhitelist);

  emptyAttributeFilter(document);
}
