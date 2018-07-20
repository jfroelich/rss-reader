import {filter_boilerplate} from '/src/filters/boilerplate2-filter.js';
import {canonicalize_urls} from '/src/filters/canonicalize-urls.js';
import {condense_tagnames} from '/src/filters/condense-tagnames.js';
import {deframe} from '/src/filters/deframe.js';
import {ensure_document_body} from '/src/filters/ensure-document-body.js';
import {filter_base_elements} from '/src/filters/filter-base-elements.js';
import {filter_blacklisted_elements} from '/src/filters/filter-blacklisted-elements.js';
import {filter_brs} from '/src/filters/filter-brs.js';
import {filter_comments} from '/src/filters/filter-comments.js';
import {filter_container_elements} from '/src/filters/filter-container-elements.js';
import {filter_dead_images} from '/src/filters/filter-dead-images.js';
import {filter_emphasis} from '/src/filters/filter-emphasis.js';
import {filter_empty_attrs} from '/src/filters/filter-empty-attrs.js';
import {filter_figures} from '/src/filters/filter-figures.js';
import {filter_form_elements} from '/src/filters/filter-form-elements.js';
import {filter_formatting_anchors} from '/src/filters/filter-formatting-anchors.js';
import {filter_formatting_elements} from '/src/filters/filter-formatting-elements.js';
import {filter_hidden_elements} from '/src/filters/filter-hidden-elements.js';
import {filter_hrs} from '/src/filters/filter-hrs.js';
import {filter_iframes} from '/src/filters/filter-iframes.js';
import {filter_invalid_anchors} from '/src/filters/filter-invalid-anchors.js';
import {filter_large_images} from '/src/filters/filter-large-images.js';
import {filter_lazy_images} from '/src/filters/filter-lazy-images.js';
import {filter_leaf_nodes} from '/src/filters/filter-leaf-nodes.js';
import {filter_lists} from '/src/filters/filter-lists.js';
import {filter_misnested_elements} from '/src/filters/filter-misnested-elements.js';
import {filter_node_whitespace} from '/src/filters/filter-node-whitespace.js';
import {filter_noscript_elements} from '/src/filters/filter-noscript-elements.js';
import {filter_responsive_images} from '/src/filters/filter-responsive-images.js';
import {filter_script_anchors} from '/src/filters/filter-script-anchors.js';
import {filter_script_elements} from '/src/filters/filter-script-elements.js';
import {filter_semantic_elements} from '/src/filters/filter-semantic-elements.js';
import {filter_small_images} from '/src/filters/filter-small-images.js';
import {filter_tables} from '/src/filters/filter-tables.js';
import {filter_unknown_attrs} from '/src/filters/filter-unknown-attrs.js';
import {lonestar_filter} from '/src/filters/lonestar-filter.js';
import {set_image_sizes} from '/src/filters/set-image-sizes.js';
import {trim_document} from '/src/filters/trim-document.js';
import * as ls from '/src/ls.js';
import {is_allowed_request} from '/src/net/fetch-policy.js';

// Applies several filters in a programmed order in order to clean up a
// document's nodes, filter out script, and make the document easily embeddable
// within another document.
export async function sanitize_document(document) {
  deframe(document);
  ensure_document_body(document);
  filter_iframes(document);
  filter_comments(document);
  filter_noscript_elements(document);

  const contrast_matte = ls.read_int('contrast_default_matte');
  const contrast_ratio = ls.read_float('min_contrast_ratio');
  filter_hidden_elements(document, contrast_matte, contrast_ratio);

  const general_blacklist = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  filter_blacklisted_elements(document, general_blacklist);

  filter_script_elements(document);


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

  const image_size_fetch_timeout = ls.read_int('set_image_sizes_timeout');
  await set_image_sizes(document, image_size_fetch_timeout, is_allowed_request);

  // This must run AFTER image sizes set otherwise the dimensions calculations
  // are off and sometimes the main article gets filtered
  filter_boilerplate(document);

  // This must run after boilerplate analysis because it affects the amount of
  // anchor text in the content
  filter_script_anchors(document);

  // TODO: compose into filter-images-by-size
  filter_small_images(document);
  filter_large_images(document);


  const condense_copy_attrs_flag = false;
  condense_tagnames(document, condense_copy_attrs_flag);

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

  const table_scan_max_rows = ls.read_int('table_scan_max_rows');
  filter_tables(document, table_scan_max_rows);

  const emphasis_max_length = ls.read_int('emphasis_max_length');
  filter_emphasis(document, emphasis_max_length);
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
