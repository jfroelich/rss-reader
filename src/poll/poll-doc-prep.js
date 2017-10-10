

function poll_doc_prep(doc, url_string) {
  'use strict';

  // TODO: inline
  function ensure_document_has_body(doc) {
    if(doc.body)
      return;
    const body_element = doc.createElement('body');
    const text_node = doc.createTextNode('Error empty document (no body found)');
    body_element.appendChild(text_node);
    doc.documentElement.appendChild(body_element);
  }

  ensure_document_has_body(doc);
  frame_transform_document(doc);
  host_template_prune(url_string, doc);
  filter_boilerplate(doc);
  secure_html_document(doc);
  sanitize_html_document(doc);

  // Because we are stripping attributes, there is no need to keep them when
  // condensing.
  const copy_attrs_on_rename = false;
  // How many rows to check when unwrapping single column tables
  const row_scan_limit = 20;
  html_shrink(doc, copy_attrs_on_rename, row_scan_limit);

  // Filter element attributes last because it is so slow and is sped up by
  // processing fewer elements.
  const attribute_whitelist = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  remove_element_attributes(doc, attribute_whitelist);
}
