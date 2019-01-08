import assert from '/src/assert.js';
import {condense_tagnames_filter} from '/src/dom-filters/condense-tagnames-filter/condense-tagnames-filter.js';
import {image_size_filter} from '/src/dom-filters/image-size-filter.js';
import {image_size_large_filter} from '/src/dom-filters/image-size-large-filter.js';
import {image_responsive_filter} from '/src/dom-filters/image-responsive-filter.js';
import {image_size_small_filter} from '/src/dom-filters/image-size-small-filter.js';
import {list_filter} from '/src/dom-filters/list-filter.js';
import {lonestar_filter} from '/src/dom-filters/lonestar-filter.js';
import {table_filter} from '/src/dom-filters/table-filter.js';
import * as simple from '/src/dom-filters/simple-filters.js';
import {url_resolve_filter} from '/src/dom-filters/url-resolve-filter.js';

export async function sanitize_document(document, options = {}) {
  assert(document instanceof Document);
  assert(typeof options === 'object');

  simple.frame_filter(document);
  simple.body_filter(document);
  simple.iframe_filter(document);
  simple.comment_filter(document);
  simple.visibility_filter(
      document, options.contrast_matte, options.contrast_ratio);
  const blacklist_general = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  simple.blacklist_filter(document, blacklist_general);
  simple.script_filter(document);

  // This should occur before canonicalizing urls, because it may set attributes
  // that need to be canonicalized that previously did not exist, and would be
  // missed by the url_resolve_filter filter. This was previously a bug.
  simple.image_lazy_filter(document);

  // This should occur before setting image sizes
  // TODO: actually the above comment is no longer true, right? Reverify. If
  // I am using baseURI now, and set-image-sizes uses baseURI, then technically
  // I do not need to do this earlier any longer. In fact I can re-imagine this
  // entirely, where this does in fact strip base elements. This could happen
  // at the end.
  url_resolve_filter(document);
  image_responsive_filter(document);
  lonestar_filter(document);
  simple.image_dead_filter(document);

  await image_size_filter(
      document, options.image_size_timeout, options.is_allowed_request);
  simple.boilerplate_filter(document);
  simple.anchor_script_filter(document);
  // TODO: compose these two filters
  image_size_small_filter(document);
  image_size_large_filter(document);

  condense_tagnames_filter(document, false);
  simple.head_filter(document);
  simple.base_filter(document);
  simple.anchor_validity_filter(document);
  simple.anchor_format_filter(document);
  simple.form_filter(document);
  simple.breakrule_filter(document);
  simple.horizontal_rule_filter(document);
  simple.format_filter(document);
  simple.nest_filter(document);
  simple.semantic_filter(document);
  simple.figure_filter(document);
  simple.container_filter(document);
  list_filter(document);
  table_filter(document, options.table_scan_max_rows);
  simple.emphasis_filter(document, options.emphasis_max_length);
  simple.node_whitespace_filter(document);
  simple.node_leaf_filter(document);
  simple.document_trim_filter(document);

  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  simple.attribute_unknown_filter(document, attribute_whitelist);
  // TODO: move this up to before some of the other attribute filters?
  simple.attribute_empty_filter(document);
}
