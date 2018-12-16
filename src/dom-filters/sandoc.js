import {condense_tagnames_filter} from '/src/dom-filters/condense-tagnames-filter.js';
import {attribute_empty_filter} from '/src/dom-filters/attribute-empty-fiter.js';
import {image_lazy_filter} from '/src/dom-filters/image-lazy-filter.js';
import {image_size_filter} from '/src/dom-filters/image-size-filter.js';
import {boilerplate_filter} from '/src/dom-filters/boilerplate-filter.js';
import {url_resolve_filter} from '/src/dom-filters/url-resolve-filter.js';
import {frame_filter} from '/src/dom-filters/frame-filter.js';
import {body_filter} from '/src/dom-filters/body-filter.js';
import {base_filter} from '/src/dom-filters/base-filter.js';
import {blacklist_filter} from '/src/dom-filters/blacklist-filter.js';
import {breakrule_filter} from '/src/dom-filters/breakrule-filter.js';
import {comment_filter} from '/src/dom-filters/comment-filter.js';
import {container_filter} from '/src/dom-filters/container-filter.js';
import {image_dead_filter} from '/src/dom-filters/image-dead-filter.js';
import {emphasis_filter} from '/src/dom-filters/emphasis-filter.js';
import {figure_filter} from '/src/dom-filters/figure-filter.js';
import {form_filter} from '/src/dom-filters/form-filter.js';
import {anchor_format_filter} from '/src/dom-filters/anchor-format-filter.js';
import {format_filter} from '/src/dom-filters/format-filter.js';
import {visibility_filter} from '/src/dom-filters/visibility-filter.js';
import {horizontal_rule_filter} from '/src/dom-filters/horizontal-rule-filter.js';
import {iframe_filter} from '/src/dom-filters/iframe-filter.js';
import {anchor_validity_filter} from '/src/dom-filters/anchor-validity-filter.js';
import {image_size_large_filter} from '/src/dom-filters/image-size-large-filter.js';
import {node_leaf_filter} from '/src/dom-filters/node-leaf-filter.js';
import {list_filter} from '/src/dom-filters/list-filter.js';
import {nest_filter} from '/src/dom-filters/nest-filter.js';
import {node_whitespace_filter} from '/src/dom-filters/node-whitespace-filter.js';
import {image_responsive_filter} from '/src/dom-filters/image-responsive-filter.js';
import {anchor_script_filter} from '/src/dom-filters/anchor-script-filter.js';
import {script_filter} from '/src/dom-filters/script-filter.js';
import {semantic_filter} from '/src/dom-filters/semantic-filter.js';
import {image_size_small_filter} from '/src/dom-filters/image-size-small-filter.js';
import {table_filter} from '/src/dom-filters/table-filter.js';
import {attribute_unknown_filter} from '/src/dom-filters/attribute-unknown-filter.js';
import {lonestar_filter} from '/src/dom-filters/lonestar-filter.js';
import {trim_filter} from '/src/dom-filters/trim-filter.js';

export async function sanitize_document(document, options = {}) {
  frame_filter(document);
  body_filter(document);
  iframe_filter(document);
  comment_filter(document);

  visibility_filter(
      document, options.contrast_matte, options.contrast_ratio);

  const blacklist_general = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  blacklist_filter(document, blacklist_general);

  script_filter(document);

  // This should occur before canonicalizing urls, because it may set attributes
  // that need to be canonicalized that previously did not exist, and would be
  // missed by the url_resolve_filter filter. This was previously a bug.
  image_lazy_filter(document);

  // This should occur before setting image sizes
  // TODO: actually the above comment is no longer true, right? Reverify. If
  // I am using baseURI now, and set-image-sizes uses baseURI, then technically
  // I do not need to do this earlier any longer. In fact I can re-imagine this
  // entirely, where this does in fact strip base elements. This could happen
  // at the end.
  url_resolve_filter(document);

  // It does not matter whether this occurs before or after url_resolve_filter
  // because url_resolve_filter handles srcsets and srcs, and this just moves
  // some srcsets into srcs
  image_responsive_filter(document);

  lonestar_filter(document);
  image_dead_filter(document);

  await image_size_filter(
      document, options.image_size_timeout, options.is_allowed_request);

  // This should occur after retrieving and setting image sizes
  boilerplate_filter(document);

  // This must run after boilerplate analysis because it affects the amount of
  // anchor text in the content
  anchor_script_filter(document);

  // TODO: compose these two filters into something like
  // image-size-constraints-filter
  image_size_small_filter(document);
  image_size_large_filter(document);

  const copy_attrs_flag = false;
  condense_tagnames_filter(document, copy_attrs_flag);

  filter_head_elements(document);
  base_filter(document);
  anchor_validity_filter(document);
  anchor_format_filter(document);
  form_filter(document);
  breakrule_filter(document);
  horizontal_rule_filter(document);
  format_filter(document);
  nest_filter(document);
  semantic_filter(document);
  figure_filter(document);
  container_filter(document);
  list_filter(document);

  table_filter(document, options.table_scan_max_rows);
  emphasis_filter(document, options.emphasis_max_length);
  node_whitespace_filter(document);

  node_leaf_filter(document);
  trim_filter(document);

  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  attribute_unknown_filter(document, attribute_whitelist);

  // TODO: move this up to before some of the other attribute filters, or
  // explain why it should occur later
  // TODO: consider aggregating with other attribute filters
  attribute_empty_filter(document);
}

function filter_head_elements(document) {
  // TODO: clarify whether a document can have multiple head elements by
  // locating and citing the spec
  const head_elements = document.querySelectorAll('head');
  for (const head_element of head_elements) {
    head_element.remove();
  }
}
