import * as config from '/src/config.js';
import {filter_boilerplate} from '/src/lib/filters/boilerplate-filter.js';
import {canonicalize_urls} from '/src/lib/filters/canonicalize-urls.js';
import {color_contrast_filter} from '/src/lib/filters/color-contrast-filter.js';
import {condense_tagnames} from '/src/lib/filters/condense-tagnames.js';
import {deframe} from '/src/lib/filters/deframe.js';
import {ensure_document_body} from '/src/lib/filters/ensure-document-body.js';
import {filter_anchor_noref} from '/src/lib/filters/filter-anchor-noref.js';
import {filter_base_elements} from '/src/lib/filters/filter-base-elements.js';
import {filter_blacklisted_elements} from '/src/lib/filters/filter-blacklisted-elements.js';
import {filter_brs} from '/src/lib/filters/filter-brs.js';
import {filter_by_host_template} from '/src/lib/filters/filter-by-host-template.js';
import {filter_comments} from '/src/lib/filters/filter-comments.js';
import {filter_container_elements} from '/src/lib/filters/filter-container-elements.js';
import {filter_dead_images} from '/src/lib/filters/filter-dead-images.js';
import {filter_emphasis} from '/src/lib/filters/filter-emphasis.js';
import {filter_empty_attrs} from '/src/lib/filters/filter-empty-attrs.js';
import {filter_figures} from '/src/lib/filters/filter-figures.js';
import {filter_form_elements} from '/src/lib/filters/filter-form-elements.js';
import {filter_formatting_anchors} from '/src/lib/filters/filter-formatting-anchors.js';
import {filter_formatting_elements} from '/src/lib/filters/filter-formatting-elements.js';
import {filter_hidden_elements} from '/src/lib/filters/filter-hidden-elements.js';
import {filter_hrs} from '/src/lib/filters/filter-hrs.js';
import {filter_iframes} from '/src/lib/filters/filter-iframes.js';
import {filter_invalid_anchors} from '/src/lib/filters/filter-invalid-anchors.js';
import {filter_large_images} from '/src/lib/filters/filter-large-images.js';
import {filter_lazy_images} from '/src/lib/filters/filter-lazy-images.js';
import {filter_leaf_nodes} from '/src/lib/filters/filter-leaf-nodes.js';
import {filter_lists} from '/src/lib/filters/filter-lists.js';
import {filter_misnested_elements} from '/src/lib/filters/filter-misnested-elements.js';
import {filter_node_whitespace} from '/src/lib/filters/filter-node-whitespace.js';
import {filter_noscript_elements} from '/src/lib/filters/filter-noscript-elements.js';
import {filter_pings} from '/src/lib/filters/filter-pings.js';
import {filter_responsive_images} from '/src/lib/filters/filter-responsive-images.js';
import {filter_script_anchors} from '/src/lib/filters/filter-script-anchors.js';
import {filter_script_elements} from '/src/lib/filters/filter-script-elements.js';
import {filter_semantic_elements} from '/src/lib/filters/filter-semantic-elements.js';
import {filter_small_images} from '/src/lib/filters/filter-small-images.js';
import {filter_tables} from '/src/lib/filters/filter-tables.js';
import {filter_telemetry_elements} from '/src/lib/filters/filter-telemetry-elements.js';
import {filter_unknown_attrs} from '/src/lib/filters/filter-unknown-attrs.js';
import {set_image_sizes} from '/src/lib/filters/set-image-sizes.js';
import {trim_document} from '/src/lib/filters/trim-document.js';

// Transforms a document by removing or changing nodes for various reasons:
// * to condense content
// * to remove hidden content
// * to remove junk content
// * to remove security-risk content by removing script
// * to accelerate content load speed
// * to preserve privacy
// * to make the content static, by removing script (dhtml)
// * to improve readability, such as be reducing the use of emphasis
// * to make the document embeddable such as by canonicalizing urls, removing
// style information, global attribute issues such as element ids, removing
// frames, removing script

// ### Implementation notes
// For performance reasons, the document is mutated. In other words, the
// transformation is applied to the input, in-place. Ideally this would be a
// pure function but cloning the document is not very feasible. This basically
// acts as a wrapper to all the content filters. The module adds value primarily
// by defining the order in which filters are applied, and by applying
// app-specific settings to otherwise generic modules (further specializing the
// filters to this app's purpose). The transform is async primarily because of
// one critical filter step that must occur after some filters but before
// others, that is async, the step where images are fetched in order to
// determine image sizes. Filters like telemetry removal need to occur
// beforehand, but some additional sanity and shrinking filters need to occur
// after. I am not entirely sure if this is the right design as I would rather
// minimize the use of async, but I have not thought of a better way. Once one
// function is async pretty much all callers up the stack need to be async. One
// of the first implementations of this module started off with a tree walker
// that applied transformations to each node. It turns out that repeatedly
// executing query selectors is substantially faster by several orders of
// magnitude. This led to the breakdown of the query selectors into individual
// filters. However, the goal of this module is to encapsulate this
// implementation detail and abstract it away. Given the substantial
// improvements in v8 recently I still wonder if the tree-walker approach is
// viable.

// TODO: Add console arg to all filters

// TODO: Create a function registry, register filters, and revise
// transform_document to iterate over the registry. Instead of hard coding, this
// should basically just iterate over an array of filter functions. Functions
// should be registered, along with parameters to them other than the document.
// Registration basically just stores the filter and its arguments in an array
// of parameterized filter objects. Then transform-document is simply an
// iteration over the registered filters, calling each one with a document and
// its preset arguments. Also, probably need priority (a number) property
// per entry, so as to be able to specify order. Should probably not use
// registration order. Or maybe registration order is fine?

// TODO: new filter idea, add a filter that condenses text nodes by doing things
// like replacing &amp;copy; with the equivalent single utf8 / unicode
// character.

// TODO: improve anti-image-hotlink handling, because we are not hotlinking, so
// review why there is a problem. http://www.javalemmings.com/DMA/Lem_1.htm

export async function transform_document(document, console) {
  deframe(document);
  ensure_document_body(document);
  filter_iframes(document);
  filter_comments(document);
  filter_noscript_elements(document);

  // Should occur before the boilerplate filter (logic)
  // Should occur before most filters (performance)
  filter_hidden_elements(document);

  // TODO: this should be implicit in filter_hidden_elements, call it there
  // instead of here. This also means I need to pass along params
  color_contrast_filter(
      document, config.contrast_default_matte, localStorage.MIN_CONTRAST_RATIO);

  const general_blacklist = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  filter_blacklisted_elements(document, general_blacklist);

  // Pre-boilerplate because this knows express structure
  filter_by_host_template(document);

  filter_boilerplate(document, console);

  // TODO: now that script filtering happens after boilerplate filtering, there
  // is no longer a problem with affecting the boilerplate algorithm by removing
  // links. There is no need to remove script elements earlier, it can happen
  // pretty much whenever. I think it makes more sense to make the script-anchor
  // filter implicit within the script filter, and abstract it away from here.
  filter_script_elements(document);
  filter_script_anchors(document);

  const condense_copy_attrs_flag = false;
  condense_tagnames(document, condense_copy_attrs_flag);

  // This should occur before setting image sizes
  // TODO: actually the above comment is no longer true, right? Reverify.
  canonicalize_urls(document);

  // This should occur before filtering lazy images and setting image sizes
  filter_responsive_images(document);

  // This should occur before removing dead images
  filter_lazy_images(document);

  // This should occur before setting image sizes. baseURI must be valid.
  filter_telemetry_elements(document);

  filter_dead_images(document);

  // This should occur after removing telemetry and other images
  await set_image_sizes(document, config.config_image_size_fetch_timeout);

  // This should occur after setting image sizes
  filter_small_images(document);
  filter_large_images(document);

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
  filter_tables(document, config.table_scan_max_rows);
  filter_emphasis(document, config.emphasis_max_length);
  filter_node_whitespace(document);

  // This should occur after most filters
  filter_leaf_nodes(document);

  // This should occur after most filters
  trim_document(document);

  // Primarily an attribute filter, so it should be called as late as
  // possible to reduce the number of elements visited
  // TODO: this should be moved to telemetry filter
  filter_anchor_noref(document);
  // TODO: this should be moved to telemetry filter
  filter_pings(document);

  // This should occur after all filters that expect a valid base URI
  filter_base_elements(document);

  // TODO: "head" should now be removed explicitly as a blacklisted element,
  // after removing the base elements. We could not remove earlier because we
  // had to retain the base element in the head in order to retain the proper
  // baseURI value. Previously head was removed at the time of removing
  // blacklisted elements, and now that is no longer the case. This is not an
  // urgent todo as head is really only a space occupier without functional
  // effect. Technically the functionality has changed though.

  // Filter attributes close to last because it is so slow and is sped up
  // by processing fewer elements.
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
