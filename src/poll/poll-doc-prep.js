// document filtering during polling

'use strict';

// Dependencies:
// assert.js
// filters/*

// TODO: rename to poll_apply_document_filters

function poll_doc_prep(doc, url) {
  ASSERT(typeof doc === 'object');


  // NOTE: these asserts are remnants of a bug that was fixed, I am leaving
  // them in for a little while longer, eventually will remove
  ASSERT(doc.createElement);
  ASSERT(typeof doc.createElement === 'function');


  // TODO: what is proper order of these two filters?
  frame_filter(doc);
  ensure_body_filter(doc);

  script_filter(doc);

  iframe_filter(doc);

  // TODO: reverse arg order, rename to filter-like name
  host_template_prune(url, doc);

  hidden_filter(doc);
  noscript_filter(doc);


  security_filter(doc);



  boilerplate_filter(doc);

  sourcless_image_filter(doc);

  invalid_anchor_filter(doc);
  formatting_anchor_filter(doc);
  form_filter(doc);
  br_filter(doc);
  hr_filter(doc);
  formatting_filter(doc);

  adoption_agency_filter(doc);
  hairspace_filter(doc);

  // Because we are stripping attributes, there is no need to keep them
  const copy_attrs_on_rename = false;
  const row_scan_limit = 20;

  shrink_filter(doc, copy_attrs_on_rename, row_scan_limit);


  // Filter element attributes last because it is so slow and is sped up by
  // processing fewer elements.
  const attribute_whitelist = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  attribute_filter(doc, attribute_whitelist);
}
