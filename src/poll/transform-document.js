import * as filters from '/src/content-filters/content-filters.js';

export async function transform_document(
    document, document_url, console, options = {}) {
  if (!(document instanceof Document)) {
    throw new TypeError('document is not a Document');
  }

  if (!(document_url instanceof URL)) {
    throw new TypeError('document_url is not a URL');
  }

  // These filters related to document.body should occur near the start, because
  // most of the other content filters pertain to document.body.
  filters.filter_frame_elements(document);
  filters.cf_ensure_body(document);

  // This filter does not apply only to body, and is a primary security concern.
  // It could occur later but doing it earlier means later filters visit fewer
  // elements.
  filters.filter_script_elements(document);
  filters.filter_iframe_elements(document);
  filters.cf_filter_comments(document);

  // This should generally occur earlier, because of websites that use an
  // information-revealing technique with noscript.
  // TODO: this is revealing a ton of garbage
  filters.filter_noscript_elements(document);

  // This can occur at any point. It should generally be done before urls are
  // resolved to reduce the work done by that filter.
  // TODO: actually, this should be done only after canonicalizing urls, and
  // the canonicalizer should consider base elements. By doing it after and
  // having canon consider it, then we support base element properly
  filters.cf_filter_base_elements(document);

  // This should occur earlier on in the pipeline. It will reduce the amount of
  // work done by later filters. It should occur before processing boilerplate,
  // because the boilerplate filter is naive about hidden elements.
  filters.filter_hidden_elements(document);

  // Do this after filtering hidden elements so that it does less work
  // This should be done prior to removing style information (either style
  // elements or inline style attributes). I am not sure whether this should be
  // done before or after boilerplate filter, but my instinct is that spam
  // techniques are boilerplate, and the boilerplate filter is naive with regard
  // to spam, so it is preferable to do it before.
  // TODO: this should be merged with filter_hidden_elements
  filters.cf_filter_low_contrast(
      document, options.matte, options.min_contrast_ratio);

  filters.filter_blacklisted_elements(document);

  // This should occur before the boilerplate filter
  // TODO: actually menu links might be scripted, so this should typically
  // occur after.
  filters.filter_script_anchors(document);

  // This should occur prior to removing boilerplate content because it has
  // express knowledge of content organization
  filters.filter_by_host_template(document, document_url);

  // This should occur before the boilerplate filter, because the boilerplate
  // filter may make decisions based on the hierarchical position of content
  // TODO: or should the bp filter account for emphasis?
  filters.cf_filter_emphasis(document, options.emphasis_length_max);

  // This should occur before filtering attributes because it makes decisions
  // based on attribute values.
  // This should occur after filtering hidden elements because it is naive with
  // regard to content visibility
  filters.cf_filter_boilerplate(document, console);

  // This should occur after bp-filter because certain condensed names may be
  // factors in the bp-filter (we don't know, not our concern). Otherwise it
  // does not matter too much. This could occur even later.
  const condense_copy_attrs_flag = false;
  filters.cf_condense_tagnames(document, condense_copy_attrs_flag);

  // This should occur before trying to set image sizes
  filters.cf_resolve_document_urls(document, document_url);

  // This should occur prior to filtering lazily-loaded images
  // This should occur prior to setting image sizes
  // Does not matter if before or after canonicalizing urls (commutative or
  // whatever the term is)
  filters.filter_responsive_images(document);

  // This should occur before removing images that are missing a src value,
  // because lazily-loaded images often are missign a source value but are
  // still useful
  filters.filter_lazy_images(document);

  // This should occur before setting image sizes to avoid unwanted network
  // requests
  filters.filter_telemetry_elements(document, document_url);

  // This should occur before trying to set image sizes simply because it
  // potentially reduces the number of images processed later. However it does
  // not truly matter because the set-image-size filter can skip over sourcless
  // images.
  filters.filter_sourceless_images(document);

  // It does not matter if this occurs before or after resolving urls. This now
  // accepts a base url parameter and dynamically canonicalizes image urls
  // (without writing back to document). This should occur after removing
  // telemetry, because this involves network requests that perhaps the
  // telemetry filter thinks should be avoided. Allow exceptions to bubble
  const fetch_image_timeout = options.fetch_image_timeout;
  // TODO: use a better name
  await filters.document_set_image_sizes(
      document, document_url, fetch_image_timeout);

  // This should occur after setting image sizes because it requires knowledge
  // of image size
  // TODO: this should be merged with filter-large-images
  filters.filter_small_images(document);

  filters.filter_invalid_anchors(document);
  filters.filter_formatting_anchors(document);
  filters.filter_form_elements(document);
  filters.cf_filter_br_elements(document);
  filters.filter_hr_elements(document);
  filters.filter_formatting_elements(document);
  filters.cf_filter_misnested_elements(document);
  filters.filter_semantic_elements(document);
  filters.cf_filter_figures(document);
  filters.filter_container_elements(document);
  filters.filter_list_elements(document);

  const table_row_scan_max = 20;
  filters.filter_table_elements(document, table_row_scan_max);

  // Better to call later than earlier to reduce number of text nodes visited
  // TODO: should this occur before boilerplate filter?
  filters.filter_node_whitespace(document);

  // This should be called after most of the other filters. Most of the other
  // filters are naive in how they leave ancestor elements meaningless or empty,
  // and simply remove elements without considering ripple effects. So this is
  // like an additional pass now that several holes have been made.
  filters.filter_leaf_nodes(document);

  // Should be called near end because its behavior changes based on what
  // content remains, and is faster with fewer elements
  filters.document_trim(document);

  // Primarily an attribute filter, so it should be called as late as possible
  // to reduce the number of elements visited
  filters.add_noreferrer_to_anchors(document);
  filters.remove_ping_attribute_from_all_anchors(document);

  filters.filter_large_image_attributes(document);

  // Filter attributes close to last because it is so slow and is sped up
  // by processing fewer elements.
  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  filters.cf_filter_non_whitelisted_attributes(document, attribute_whitelist);

  // TODO: move this up to before some of the other attribute filters, or
  // explain why it should occur later
  // TODO: consider aggregating with other attribute filters
  filters.document_filter_empty_attributes(document);
}
