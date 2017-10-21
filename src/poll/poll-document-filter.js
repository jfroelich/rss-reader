'use strict';

// import base/assert.js
// import base/status.js
// import filters/base-filter.js
// import filters/frame-filter.js
// import filters/responsive-image-filter.js
// import http/url.js

// TODO: add emphasis_filter

// Transforms a document's content by removing or changing nods for
// various reasons.
// @param doc {Document} the document to transform
// @param url {String} the canonical url of the document
// @param fetch_image_timeout_ms {Number} optional, the number of milliseconds
// to wait before timing out when fetching an image
async function poll_document_filter(doc, url, fetch_image_timeout_ms) {
  ASSERT(doc instanceof Document);
  ASSERT(url_is_valid(url));

  frame_filter(doc);
  ensure_body_filter(doc);

  script_filter(doc);
  iframe_filter(doc);
  comment_filter(doc);
  base_filter(doc);

  // TODO: is this the proper place to call this in filter order?
  host_template_prune(url, doc);

  hidden_filter(doc);
  noscript_filter(doc);
  blacklist_filter(doc);
  script_anchor_filter(doc);
  boilerplate_filter(doc);
  condense_tagnames_filter(doc);

  const base_url = new URL(url);
  canonical_url_filter(doc, base_url);

  // This should occur prior to lazy_image_filter
  // This should occur prior to image_size_filter
  // Does not matter if before or after canonical_url_filter
  response_image_filter(doc);

  // This should occur before sourcless_image_filter
  lazy_image_filter(doc);

  // This should occur before image_size_filter
  lonestar_filter(doc);

  sourcless_image_filter(doc);

  // This should occur after canonical_url_filter
  // This should occur after lonestar_filter
  let allowed_protocols; // defer to defaults
  // Allow exceptions to bubble (for now)
  await image_size_filter(doc, allowed_protocols, fetch_image_timeout_ms);


  invalid_anchor_filter(doc);
  formatting_anchor_filter(doc);
  form_filter(doc);
  br_filter(doc);
  hr_filter(doc);
  formatting_filter(doc);

  adoption_agency_filter(doc);
  hairspace_filter(doc);

  semantic_filter(doc);
  figure_filter(doc);
  container_filter(doc);

  list_filter(doc);

  const row_scan_limit = 20;
  table_filter(doc, row_scan_limit);

  // Better to call later than earlier to reduce number of text nodes visited
  node_whitespace_filter(doc);

  leaf_filter(doc);

  // Should be called near end because its behavior changes based on
  // what content remains, and is faster with fewer elements
  trim_document_filter(doc);

  // Primarily an attribute filter, so it should be caller as late as possible
  // to reduce the number of elements visited
  noreferrer_filter(doc);
  ping_filter(doc);

  // Filter element attributes last because it is so slow and is sped up by
  // processing fewer elements.
  const attribute_whitelist = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  attribute_filter(doc, attribute_whitelist);

  return STATUS_OK;
}
