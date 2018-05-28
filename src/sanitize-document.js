import {fetch_policy} from '/src/fetch-policy.js';
import {filter_boilerplate} from '/src/lib/filters/boilerplate-filter.js';
import {canonicalize_urls} from '/src/lib/filters/canonicalize-urls.js';
import {condense_tagnames} from '/src/lib/filters/condense-tagnames.js';
import {deframe} from '/src/lib/filters/deframe.js';
import {ensure_document_body} from '/src/lib/filters/ensure-document-body.js';
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
import {filter_responsive_images} from '/src/lib/filters/filter-responsive-images.js';
import {filter_script_anchors} from '/src/lib/filters/filter-script-anchors.js';
import {filter_script_elements} from '/src/lib/filters/filter-script-elements.js';
import {filter_semantic_elements} from '/src/lib/filters/filter-semantic-elements.js';
import {filter_small_images} from '/src/lib/filters/filter-small-images.js';
import {filter_tables} from '/src/lib/filters/filter-tables.js';
import {filter_unknown_attrs} from '/src/lib/filters/filter-unknown-attrs.js';
import {lonestar_filter} from '/src/lib/filters/lonestar-filter.js';
import {set_image_sizes} from '/src/lib/filters/set-image-sizes.js';
import {trim_document} from '/src/lib/filters/trim-document.js';
import {localstorage_read_float} from '/src/lib/localstorage-read-float.js';
import {localstorage_read_int} from '/src/lib/localstorage-read-int.js';

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
//
// The document is modified in place because it is too expensive to clone.
// The function works by applying several filters. Its value comes from how it
// calls the filters in a programmed order.
// It is async primarily just because of a middle step related to setting sizes
// of images that is also async.

// TODO: Add console arg to all filters

// TODO: Create a function registry, register filters, and revise
// sanitize_document to iterate over the registry. Instead of hard coding, this
// should basically just iterate over an array of filter functions. Functions
// should be registered, along with parameters to them other than the document.
// Registration basically just stores the filter and its arguments in an array
// of parameterized filter objects. Then transform-document is simply an
// iteration over the registered filters, calling each one with a document and
// its preset arguments. Also, probably need priority (a number) property
// per entry, so as to be able to specify order. Should probably not use
// registration order. Or maybe registration order is fine?

// TODO: new filter idea, add a filter that condenses text nodes by doing things
// like replacing named or numbered encoded entities (such as copy) with the
// equivalent single utf8 / unicode character.

// TODO: improve anti-image-hotlink handling, because we are not hotlinking, so
// review why there is a problem. http://www.javalemmings.com/DMA/Lem_1.htm

// TODO: why set image sizes again? i think this was because of boilerplate
// filter reliance on image area. but i relaxed that, right? so why do it? if
// i don't need it the function would no longer need to be async, and would be
// substantially faster.

export async function sanitize_document(document, console) {
  deframe(document);
  ensure_document_body(document);
  filter_iframes(document);
  filter_comments(document);
  filter_noscript_elements(document);

  // I am not doing either of these todos immediately because the current task
  // is to transition to local storage.

  // TODO: i think the sanitize_document for some of the local storage values
  // might be overly cautious. Instead I could treat these as default settings
  // of the filter itself. Still loaded in app, and sent from app to the lib
  // filter. Because libs shouldn't directly interact with local storage
  // (right?). I think so. Because that makes them difficult to reuse and test.
  // They shouldn't interact with app settings. Really this is just how the
  // app is choosing to persist the values. The libs can use local storage but
  // not for app settings. Therefore the todo really is to rename
  // sanitize_document_low_contrast_default_matte to something like
  // filter_hidden_elements_default_matte. I use filter-hidden because this is
  // a parameter to filter-hidden now because that encapsulates the low-contrast
  // filter.

  // TODO: the min-contrast-ratio setting name should be lowercased, and it
  // should also be set on install

  // Should occur before the boilerplate filter (logic)
  // Should occur before most filters (performance)
  const matte =
      localstorage_read_int('sanitize_document_low_contrast_default_matte');
  const mcr = localstorage_read_float('MIN_CONTRAST_RATIO');
  filter_hidden_elements(document, matte, mcr);

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
  lonestar_filter(document);

  filter_dead_images(document);

  // This should occur after removing telemetry and other images
  const image_size_fetch_timeout =
      localstorage_read_int('sanitize_document_image_size_fetch_timeout');
  await set_image_sizes(document, image_size_fetch_timeout, fetch_policy);

  // This should occur after setting image sizes
  // TODO: compose into filter-images-by-size
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

  const table_scan_max_rows =
      localstorage_read_int('sanitize_document_table_scan_max_rows');
  filter_tables(document, table_scan_max_rows);

  const emphasis_max_length =
      localstorage_read_int('sanitize_document_emphasis_max_length');
  filter_emphasis(document, emphasis_max_length);
  filter_node_whitespace(document);

  // This should occur after most filters
  filter_leaf_nodes(document);

  // This should occur after most filters
  trim_document(document);

  // This should occur after all filters that expect a valid base URI
  filter_base_elements(document);

  // Strip head elements. Head elements used to be blacklisted and stripped
  // earlier but that changed when switching to using baseURI in order to
  // maintain base elements.
  // TODO: make this into a filter of some sort
  // TODO: clarify whether a document can have multiple head elements by
  // locating and citing the spec
  const head_elements = document.querySelectorAll('head');
  for (const head_element of head_elements) {
    head_element.remove();
  }

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
