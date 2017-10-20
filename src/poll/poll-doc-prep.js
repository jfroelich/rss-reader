'use strict';

// Dependencies:
// assert.js
// filters/*
// status.js

// TODO: rename to poll_apply_document_filters

function poll_doc_prep(doc, url) {
  ASSERT(typeof doc === 'object');

  // TODO: what is proper order of these two filters?
  frame_filter(doc);
  ensure_body_filter(doc);

  script_filter(doc);

  iframe_filter(doc);

  // TODO: reverse arg order, rename to filter-like name
  // TODO: is this the proper place to call this in filter order?
  host_template_prune(url, doc);

  hidden_filter(doc);
  noscript_filter(doc);

  blacklist_filter(doc);

  script_anchor_filter(doc);

  boilerplate_filter(doc);

  condense_tagnames_filter(doc);

  sourcless_image_filter(doc);

  invalid_anchor_filter(doc);
  formatting_anchor_filter(doc);
  form_filter(doc);
  br_filter(doc);
  hr_filter(doc);
  formatting_filter(doc);

  adoption_agency_filter(doc);
  hairspace_filter(doc);

  comment_filter(doc);

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
  // what content remains
  trim_document_filter(doc);

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
