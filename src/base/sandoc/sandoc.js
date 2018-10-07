import {condense_tagnames_filter} from '/src/base/condense-tagnames-filter.js';
import {filter_empty_attrs} from '/src/base/filter-empty-attrs.js';
import {filter_lazy_images} from '/src/base/filter-lazy-images.js';
import {set_image_sizes} from '/src/base/image-size-filter/image-size-filter.js';

import {filter_boilerplate} from './boilerplate-filter.js';
import {canonicalize_urls} from './canonicalize-urls.js';
import {deframe} from './deframe.js';
import {ensure_document_body} from './ensure-document-body.js';
import {filter_base_elements} from './filter-base-elements.js';
import {filter_blacklisted_elements} from './filter-blacklisted-elements.js';
import {filter_brs} from './filter-brs.js';
import {filter_comments} from './filter-comments.js';
import {filter_container_elements} from './filter-container-elements.js';
import {filter_dead_images} from './filter-dead-images.js';
import {filter_emphasis} from './filter-emphasis.js';
import {filter_figures} from './filter-figures.js';
import {filter_form_elements} from './filter-form-elements.js';
import {filter_formatting_anchors} from './filter-formatting-anchors.js';
import {filter_formatting_elements} from './filter-formatting-elements.js';
import {filter_hidden_elements} from './filter-hidden-elements.js';
import {filter_hrs} from './filter-hrs.js';
import {filter_iframes} from './filter-iframes.js';
import {filter_invalid_anchors} from './filter-invalid-anchors.js';
import {filter_large_images} from './filter-large-images.js';
import {filter_leaf_nodes} from './filter-leaf-nodes.js';
import {filter_lists} from './filter-lists.js';
import {filter_misnested_elements} from './filter-misnested-elements.js';
import {filter_node_whitespace} from './filter-node-whitespace.js';
import {filter_responsive_images} from './filter-responsive-images.js';
import {filter_script_anchors} from './filter-script-anchors.js';
import {filter_script} from './filter-script.js';
import {filter_semantic_elements} from './filter-semantic-elements.js';
import {filter_small_images} from './filter-small-images.js';
import {filter_tables} from './filter-tables.js';
import {filter_unknown_attrs} from './filter-unknown-attrs.js';
import {lonestar_filter} from './lonestar-filter.js';
import {trim_document} from './trim-document.js';

// Applies several filters in a programmed order in order to clean up a
// document's nodes, filter out script, and make the document easily embeddable
// within another document.
export async function sanitize_document(document, options = {}) {
  deframe(document);
  ensure_document_body(document);
  filter_iframes(document);
  filter_comments(document);

  filter_hidden_elements(
      document, options.contrast_matte, options.contrast_ratio);

  const general_blacklist = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  filter_blacklisted_elements(document, general_blacklist);

  filter_script(document);

  // This should occur before setting image sizes
  // TODO: actually the above comment is no longer true, right? Reverify. If
  // I am using baseURI now, and set-image-sizes uses baseURI, then technically
  // I do not need to do this earlier any longer. In fact I can re-imagine this
  // entirely, where this does in fact strip base elements. This could happen
  // at the end.
  canonicalize_urls(document);

  filter_responsive_images(document);
  filter_lazy_images(document);
  lonestar_filter(document);
  filter_dead_images(document);

  await set_image_sizes(
      document, options.image_size_timeout, options.is_allowed_request);

  // This should occur after setting image sizes for higher accuracy
  filter_boilerplate(document);

  // This must run after boilerplate analysis because it affects the amount of
  // anchor text in the content
  filter_script_anchors(document);

  // TODO: compose into filter-images-by-size
  filter_small_images(document);
  filter_large_images(document);

  const copy_attrs_flag = false;
  condense_tagnames_filter(document, copy_attrs_flag);

  filter_head_elements(document);
  filter_base_elements(document);
  filter_invalid_anchors(document);
  filter_formatting_anchors(document);
  filter_form_elements(document);
  filter_brs(document);
  filter_hrs(document);
  filter_formatting_elements(document);
  filter_misnested_elements(document);
  filter_semantic_elements(document);
  filter_figures(document);
  filter_container_elements(document);
  filter_lists(document);

  filter_tables(document, options.table_scan_max_rows);
  filter_emphasis(document, options.emphasis_max_length);
  filter_node_whitespace(document);

  filter_leaf_nodes(document);
  trim_document(document);

  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  filter_unknown_attrs(document, attribute_whitelist);

  // TODO: move this up to before some of the other attribute filters, or
  // explain why it should occur later
  // TODO: consider aggregating with other attribute filters
  filter_empty_attrs(document);
}

function filter_head_elements(document) {
  // TODO: clarify whether a document can have multiple head elements by
  // locating and citing the spec
  const head_elements = document.querySelectorAll('head');
  for (const head_element of head_elements) {
    head_element.remove();
  }
}
