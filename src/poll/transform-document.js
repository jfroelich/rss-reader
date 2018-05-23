import * as filters from '/src/content-filters/content-filters.js';
import * as color from '/src/lib/color.js';
import {filter_boilerplate} from '/src/lib/filters/boilerplate-filter.js';
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
import {filter_sourceless_images} from '/src/lib/filters/filter-sourceless-images.js';
import {filter_tables} from '/src/lib/filters/filter-tables.js';
import {filter_telemetry_elements} from '/src/lib/filters/filter-telemetry-elements.js';
import {filter_unknown_attrs} from '/src/lib/filters/filter-unknown-attrs.js';
import {resolve_document_urls} from '/src/lib/filters/resolve-document-urls.js';
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

// ### Options
// fetch_image_timeout {Number} optional, the number of milliseconds to
// wait before timing out when fetching an image
// matte {color} the default background color to use when determining an
// element's background
// min_contrast_ratio {Number} the ratio to use when determining whether
// an element's content is visible
// emphasis_length_max {Number} the maximum number of characters in a
// section of emphasized text before the emphasis is removed

// ### Errors
// * type errors (invalid input)

// ### Return value
// Returns a promise that resolves to undefined or rejects when an internal
// error occurs

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

// TODO:
// 1. Set options in config.js and read them here, instead of hardcoding here
// 3. Create a function registry, register filters, and revise
// transform_document to iterate over the registry. Instead of hard coding, this
// should basically just iterate over an array of filter functions. Functions
// should be registered, along with parameters to them other than the document.
// Registration basically just stores the filter and its arguments in an array
// of parameterized filter objects. Then transform-document is simply an
// iteration over the registered filters, calling each one with a document and
// its preset arguments But what to do about things like document_url? Pass it
// to every filter? Or maybe focus first on using document.baseURI so that there
// is no need for an additional explicit parameter because it becomes implicit
// in the document parameter? Also, probably need priority (a number) property
// per entry, so as to be able to specify order. Should probably not use
// registration order. Or maybe registration order is fine?
// 4. Add console arg to all filters
// 5. drop document-url parameter. implement set-base-uri(document) as a
// standalone independent library. require all callers to set it. refactor all
// filters to operate with the assumption that the base uri is set. note that
// canonicalize-urls still needs to strip the base-uri later, because that is
// the only way to make the document 'embeddable' in a multi-document view
// without causing base-uri conflicts.

// TODO: perhaps all filters should return a document. They could return the
// same input document, or a new document. It would be semi-opaque to the caller
// and allow for easier transition to immutable treatment of document.

// TODO: new filter idea, add a filter that condenses text nodes by doing things
// like replacing &amp;copy; with the equivalent single utf8 / unicode
// character.

// TODO: improve anti-image-hotlink handling, because we are not hotlinking, so
// review why there is a problem. http://www.javalemmings.com/DMA/Lem_1.htm

export async function transform_document(document, document_url, console) {
  // TODO: step 1 here should be to verify the document has a base-uri and
  // that the base-uri is not somehow the uri of the page that includes this
  // script that is running (which may be the default??)

  deframe(document);
  ensure_document_body(document);
  filter_script_elements(document);
  filter_iframes(document);
  filter_comments(document);
  filter_noscript_elements(document);
  filter_base_elements(document);

  // This should occur earlier in the pipeline because it tends to reduce
  // the amount of work done by later filters. It should occur before
  // processing boilerplate, because the boilerplate filter is naive about
  // hidden elements. This is done before the blacklist filter because of
  // the idea that this filter will tend to remove large branches where as
  // the blacklist filter more likely removes small branches, and there is a
  // decent chance many of those small branches live on the large and hidden
  // branches, so less work is done this way in the normal/typical case.
  filter_hidden_elements(document);

  // Do this after filtering hidden elements so that it does less work
  // This should be done prior to removing style information (either style
  // elements or inline style attributes). I am not sure whether this should
  // be done before or after boilerplate filter, but my instinct is that
  // spam techniques are boilerplate, and the boilerplate filter is naive
  // with regard to spam, so it is preferable to do it before.

  const matte = color.WHITE;
  const mcr = localStorage.MIN_CONTRAST_RATIO;
  color_contrast_filter(document, matte, mcr);

  // TODO: which elements are in the blacklist is app-policy, not lib
  // policy. The lib function should accept a blacklist parameter and modify
  // the document accordingly, not decide on its own using a hardcoded
  // internal list. Therefore, I should define an array here of blacklisted
  // element names, and pass this as a parameter.
  filter_blacklisted_elements(document);

  // This should occur prior to removing boilerplate content because it has
  // express knowledge of content organization
  filter_by_host_template(document, document_url);

  // This should occur before the boilerplate filter, because the
  // boilerplate filter may make decisions based on the hierarchical
  // position of content
  // TODO: or should it occur after?
  const emphasis_length_max = 200;
  filter_emphasis(document, emphasis_length_max);

  // This should occur before filtering attributes because it makes
  // decisions based on attribute values. This should occur after filtering
  // hidden elements because it is naive with regard to content visibility
  filter_boilerplate(document, console);

  // This is a followup security sweep to the script element filter. It
  // occurs after boilerplate filtering so that scripted links are still
  // considered as independent variables by the boilerplate filter. The
  // correctness of this is not too concerning given that the Content
  // Security Policy prevents such links from working. This is more of a
  // paranoid pass.
  filter_script_anchors(document);

  // This should occur after bp-filter because certain condensed names may
  // be factors in the bp-filter (we don't know, not our concern). Otherwise
  // it does not matter too much. This could occur even later.
  const condense_copy_attrs_flag = false;
  condense_tagnames(document, condense_copy_attrs_flag);

  // This should occur before trying to set image sizes
  resolve_document_urls(document, document_url);

  // This should occur prior to filtering lazily-loaded images
  // This should occur prior to setting image sizes
  // Does not matter if before or after canonicalizing urls (commutative or
  // whatever the term is)
  filter_responsive_images(document);

  // This should occur before removing src-less images
  filter_lazy_images(document);

  // This should occur before setting image sizes to avoid unwanted network
  // requests
  filter_telemetry_elements(document, document_url);

  // TODO: revise as filter-invalid-image-urls, where empty source is one case
  // of invalidity, other case is malformed url
  filter_sourceless_images(document);

  // It does not matter if this occurs before or after resolving urls. This
  // now accepts a base url parameter and dynamically canonicalizes image
  // urls (without writing back to document). This should occur after
  // removing telemetry, because this involves network requests that perhaps
  // the telemetry filter thinks should be avoided. Allow exceptions to
  // bubble
  // TODO: set this in config.js and get from config.js
  const fetch_image_timeout = 3000;
  await set_image_sizes(document, document_url, fetch_image_timeout);

  // This should occur after setting image sizes because it requires
  // knowledge of image size
  filter_small_images(document);

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

  const table_row_scan_max = 20;
  filter_tables(document, table_row_scan_max);

  // It does not matter whether this is before or after the boilerplate filter,
  // because the boilerplate filter considers whitespace in its algorithm, and
  // in particular it considers excess whitespace
  filter_node_whitespace(document);

  // This should be called after most of the other filters. Most of the
  // other filters are naive in how they leave ancestor elements meaningless
  // or empty, and simply remove elements without considering ripple
  // effects. So this is like an additional pass now that several holes have
  // been made.
  filter_leaf_nodes(document);

  // Should be called near end because its behavior changes based on what
  // content remains, and is faster with fewer elements
  trim_document(document);

  // Primarily an attribute filter, so it should be called as late as
  // possible to reduce the number of elements visited
  filter_anchor_noref(document);
  filter_pings(document);

  filter_large_images(document);

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
