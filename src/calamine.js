// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Provides the calamine.transform(HTMLDocument) function that guesses at the
 * content of a document. In other words, applying lotion to soothe NLP
 * shingles.
 *
 * TODO: express everything as probability. Use a scale of 0 to 100
 * to represent each element's likelihood of being useful content, where
 * 100 is most likely. Every blcok gets its own probability score. Then
 * iteratively backfrom from a threshold of something like 50%. Or instead
 * of blocks weight the elements and use the best element approach again,
 * where probability means the likelihood of any given element being the
 * best element, not whether it is content or boilerplate.
 */
(function (exports) {
'use strict';

var forEach = Array.prototype.forEach;
var reduce = Array.prototype.reduce;

/**
 * Used to split up the value of an attribute into tokens.
 */
var RE_TOKEN_DELIMITER = /[\s\-_0-9]+/g;

// Expose public API
exports.calamine = {};

function detachBySelector(root, selector) {
  // querySelector is used because (1) the code is more concise, (2) the perf
  // delta from querySelectorAll is immaterial, and (3) this avoids the need
  // to check doc.contains(element) per iteration, as the selector restarts
  // from the outer ancestor.
  for(var element = root.querySelector(selector); element;
    element = root.querySelector(selector)) {
    element.remove();
  }
}

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 * TODO: rename to 'rub'?
 */
exports.calamine.transform = function transform_(doc, options) {

  var optType = typeof options;
  options = optType == 'object' || optType == 'function' ? options : {};

  // Note: Ideally I would use a block-based approach that would avoid the need
  // for this step but the current best element approach effectively requires
  // it. These selectors target boilerplate typically found in the best
  // element, after processing, but are applied before processing to reduce the
  // amount of elements considered and reduce error. Most of the selectors are
  // conservative to avoid filtering non-boilerplate
  var detachFromRootBySelector = detachBySelector.bind(this, doc.body);
  BLACKLIST_SELECTORS.forEach(detachFromRootBySelector);

  var elements = doc.body.getElementsByTagName('*');

  // Initialize scores
  var scores = new Map();
  scores.set(doc.documentElement, 0);
  scores.set(doc.body, 0);
  forEach.call(elements, function (e) { scores.set(e, 0); });

  // Count text lengths per element. This uses an agglomerative approach in
  // contrast to a top down approach (using element.textContent) due to
  // performance issues
  var charCounts = new Map();
  for(var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT),
    node = it.nextNode(), count; node; node = it.nextNode()) {
    // NOTE: trim to prevent large amounts of whitespace from undue bias
    for(count = node.nodeValue.trim().length,
      node = count ? node.parentNode: undefined; node;
      node = node.parentNode) {
      charCounts.set(node, (charCounts.get(node) || 0) + count);
    }
  }

  // Aggregate the count of text within anchors within ancestors. Done from the
  // bottom up in a second pass for performance
  var anchorChars = new Map();
  forEach.call(doc.body.querySelectorAll('a[href]'), function (anchor) {
    for(var n = charCounts.get(anchor), el = n ? anchor : undefined; el;
      el = el.parentElement) {
      anchorChars.set(el, (anchorChars.get(el) || 0) + n);
    }
  });

  // Apply a bias based the number of characters and the number of characters
  // within anchors to each element's score. This "magical" formula is an
  // adaptation of a simple regression using some empirical weights.
  // Nodes with large amounts of text, that is not anchor text, get the most
  // positive bias. Adapted from "Boilerplate Detection using Shallow Text
  // Features" http://www.l3s.de/~kohlschuetter/boilerplate
  forEach.call(elements, function (e) {
    var cc = charCounts.get(e) || 0;
    var acc = anchorChars.get(e) || 0;
    var bias = 0.25 * cc - 0.7 * acc;
    // Tentatively cap bias
    bias = Math.min(4000, bias);
    scores.set(e, scores.get(e) + bias);
  });

  // Apply an intrinsic bias (based on the type of element itself)
  forEach.call(elements, function (e) {
    scores.set(e, scores.get(e) + (INTRINSIC_BIAS.get(e.localName) || 0));
  });

  // Pathological case for <article> element intrinsic bias that accounts for
  // use of the article element to refer to other articles (e.g. Miami Herald)
  var articles = doc.body.getElementsByTagName('article');
  if(articles.length == 1) {
    scores.set(articles[0], scores.get(articles[0]) + 1000);
  } else {
    forEach.call(articles, updateScore.bind(null, scores, 100));
  }

  // Penalize list descendants
  forEach.call(doc.body.querySelectorAll('li *,ol *,ul *, dd *, dl *'),
    updateScore.bind(null, scores, -20));

  // Penalize descendants of navigational elements. Due to pre-filtering this
  // is largely a no-op, but pre-filtering may be disabled in the future.
  // Essentially this just biases asides because header/footer/nav are
  // in the template blacklist.
  forEach.call(doc.body.querySelectorAll('aside *, header *, footer *, nav *'),
    updateScore.bind(null, scores, -50));

  // Score images and image parents
  forEach.call(doc.body.getElementsByTagName('img'), function (image) {
    var parent = image.parentElement;
    // Avoid over-promotion of slideshow-container elements
    var carouselBias = reduce.call(parent.childNodes, function (bias, node) {
      return 'img' === node.localName && node !== image ? bias - 50 : bias;
    }, 0);
    // Bump images that the author bothered to describe
    var descBias = image.getAttribute('alt') ||
      image.getAttribute('title') || (parent.localName == 'figure' &&
      parent.querySelector('figcaption')) ? 30 : 0;
    // Proportionally promote large images
    var area = image.width ? image.width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);

    scores.set(image, scores.get(image) + descBias + areaBias);
    scores.set(parent, scores.get(parent) + carouselBias + descBias +
      areaBias);
  });

  // Bias the parent of certain elements
  forEach.call(elements, function (element) {
    var parent = element.parentElement;
    var bias = DESCENDANT_BIAS.get(element.localName) || 0;
    scores.set(parent, scores.get(parent) + bias);
  });

  // Apply attribute bias
  applyAttributeBias(doc, elements, scores);

  // Conditionally expose attributes for debugging
  var docElements = doc.documentElement.getElementsByTagName('*');
  if(options.SHOW_CHAR_COUNT) {
    forEach.call(docElements, function (e) {
      e.setAttribute('cc', charCounts.get(e) || 0);
    });
  }
  if(options.SHOW_ANCHOR_CHAR_COUNT) {
    forEach.call(docElements, function (e) {
      e.setAttribute('acc', anchorChars.get(e) || 0);
    });
  }
  if(options.SHOW_SCORE) {
    forEach.call(docElements, function (e) {
      e.setAttribute('score', scores.get(e) || 0);
    });
  }

  // Find the highest scoring element, defaulting to doc.body
  var result = reduce.call(elements, function (max, current) {
    return scores.get(current) > scores.get(max) ? current : max;
  }, doc.body);

  // Yield the final result, the element that most likely contains
  // the targeted content (less some expressly filtered boilerplate)
  return result;
}

/**
 * Applies an attribute bias to each element's score. Due to very poor
 * performance, this is implemented as a separate function that uses basic
 * loops and a more imperative style.
 */
function applyAttributeBias(doc, elements, scores) {

  // TODO: research itemscope
  // TODO: research opengraph semantics

  // TODO: itemtype has the same issues as 'article' id/class,
  // in that some articles use the itemtype repeatedly

  // For each element, collect all its attribute values, tokenize the
  // values, and then sum up the biases for the tokens and apply them to
  // the element's score.

  for(var i = 0, bias=0, element, length = elements.length,
    tokens = new Set(); i < length; bias = 0, tokens.clear(), i++) {
    element = elements[i];
    appendTokens(element.getAttribute('id'), tokens);
    appendTokens(element.getAttribute('name'), tokens);
    appendTokens(element.getAttribute('class'), tokens);
    appendTokens(element.getAttribute('itemprop'), tokens);
    appendTokens(element.getAttribute('role'), tokens);
    appendTokens(getItemType(element), tokens);

    for(var it = tokens.values(), val = it.next().value; val;
      val = it.next().value) {
      bias += ATTRIBUTE_BIAS.get(val) || 0;
    }
    scores.set(element, scores.get(element) + bias);
  }

  // Pathological cases for "articleBody"
  // See, e.g., ABC News, Comic Book Resources
  // Also, because 'article' not in attribute bias, explicitly search here
  // for itemtype article (see schema.org)

  // TODO: article_body (E-Week)

  var articleAttributes =  ['id', 'class', 'name', 'itemprop', 'role'].map(
    function(s) { return '['+s+'*="articlebody"]'; });
  articleAttributes.push('[itemtype="http://schema.org/Article"]');

  var SELECT_ARTICLE = articleAttributes.join(',');
  var articles = doc.body.querySelectorAll(SELECT_ARTICLE);
  if(articles.length == 1) {
    scores.set(articles[0], scores.get(articles[0]) + 1000);
  } else {
    forEach.call(articles, updateScore.bind(null, scores, 100));
  }
}

// Helper function for applyAttributeBias
function appendTokens(str, set) {
  if(!str) return;
  str = str.trim();
  if(!str) return;

  // TODO: consider splitting by case-transition (e.g. upper2lower)

  var tokens = str.toLowerCase().split(RE_TOKEN_DELIMITER);
  for(var i = 0; i < tokens.length; i++) {
    set.add(tokens[i]);
  }
}

// Helper function for applyAttributeBias that gets the
// path component of a schema url
function getItemType(element) {

  // So far the following have been witnessed in the wild
  // http://schema.org/Article
  // http://schema.org/NewsArticle
  // http://schema.org/BlogPosting
  // http://schema.org/Blog

  var value = element.getAttribute('itemtype');
  if(!value) return;
  value = value.trim();
  if(!value) return;
  var lastSlashIndex = value.lastIndexOf('/');
  if(lastSlashIndex == -1) return;
  var path = value.substring(lastSlashIndex + 1);
  return path;
}

// Helper for transformDocument
function updateScore(scores, delta, element) {
  // NOTE: assumes element always exists
  scores.set(scores.get(element) + delta);
}

// Hardcoded template-based selectors that are very likely
// to contain boilerplate. Empirically collected.
var BLACKLIST_SELECTORS = [
  'a.aggregated-rel-link', // // The Oklahoman
  'a.carousel-control', // The Miami Herald
  'a.more-tab', // The Oklahoman
  'a[rel="tag"]', // // The Oklahoman
  'a.skip-to-text-link', // NYTimes
  'aside.itemAsideInfo', // The Guardian
  'aside#asset-related', // St. Louis Today
  'aside#bpage_ad_bottom', // BuzzFeed
  'aside[data-panelmod-type="relatedContent"]', // LA Times
  'aside.callout', // The Atlantic
  'aside.marginalia', // NY Times
  'aside#post_launch_success', // BuzzFeed
  'aside.related-articles', // BBC
  'aside.related-content', // // The Oklahoman
  'aside#related-content-xs', // The Miami Herald
  'aside.related-side', // NY Magazine
  'aside.right-rail-module', // Time
  'aside#sidebar', // TechSpot
  'aside.story-right-rail', // USA Today
  'aside.tools', // The Boston Globe
  'aside.views-tags', // BuzzFeed
  'aside.widget-area', // thedomains.com
  'div#a-all-related', // New York Daily News
  'div.ad', // Reuters
  'div.ad-cluster-container', // TechCrunch
  'div.ad-container', // Fox News
  'div.adAlone300', // The Daily Herald
  'div.adCentred', // The Sydney Morning Herald
  'div.adjacent-entry-pagination', // thedomains.com
  'div#addshare', // The Hindu
  'div.admpu', // Telegraph UK
  'div.ad-unit', // TechCrunch
  'div.addthis_toolbox', // NobelPrize.org
  'div.artbody > div.share', // China Topix
  'div.art_tabbed_nav', // The Wall Street Journal (blog)
  'div#article div.share', // timeslive.co.za
  'div.article_actions', // Forbes
  'div.article_cat', // Collegian
  'div.articleComments', // Reuters
  'div#articleIconLinksContainer', // The Daily Mail
  'div.article-social', // Fortune Magazine
  'div.articleEmbeddedAdBox', // Mercury News
  'div.article-extra', // TechCrunch
  'div.article_interaction', // Bloomberg
  'div.article-list', // // The Oklahoman
  'div#articleKeywords', // The Hindu
  'div.articleMeta', // Tampa Bay
  'div.articleOptions', // Mercury News
  'div.article-pagination', // UT San Diego
  'div.article-print-url', // USA Today
  'div.articleShareBottom', // Fox Sports
  'div.article-side', // The Times
  'div.article-tags', // entrepeneur.com
  'div.article-tools', // The Atlantic
  'div.articleViewerGroup', // Mercury News
  'div.assetBuddy', // Reuters
  'div.author_topics_holder', // The Irish Times
  'div[data-ng-controller="bestOfMSNBCController"]', // MSNBC
  'div#blq-foot', // BBC
  'div#blog-sidebar', // Comic Book Resources
  'div.bpcolumnsContainer', // Western Journalism
  'div#breadcrumb', // Autonews
  'div#breadcrumbs', // E-Week
  'div.browse', // ABC News
  // Several websites, only way to identify Autonews
  'div.byline',
  'div.byline_links', // Bloomberg
  'div#ce-comments', // E-Week
  'div.cnn_strybtntools', // CNN
  'div.cnn_strylftcntnt', // CNN
  'div.cnn_strycntntrgt', // CNN
  'div#commentary', // Autonews
  'div#comment_bar', // Autonews
  'div#commentBar', // Newsday
  'div.comment_bug', // Forbes
  'div#comment-container', // auburnpub.com
  'div#comments', // CBS News
  'div.comments', // TechCrunch
  'div.commentCount', // Reuters
  'div.comment-count', // auburnpub.com
  'div.comment-count-block',// TechSpot
  'div.comment_count_affix', // // The Oklahoman
  'div.commentDisclaimer', // Reuters
  'div.comment-holder', // entrepeneur.com
  'div#commenting', // Fox News
  'div#commentLink', // // The Oklahoman
  'div.comment_links', // Forbes
  'div.comments-overall', // Aeon Magazine
  'div.comment-policy-box', // thedomains.com
  'div.controls', // NY Daily News
  'div.correspondant', // CBS News
  'div[data-module-zone="articletools_bottom"]', // The Wall Street Journal
  'div[data-ng-controller="moreLikeThisController"]', // MSNBC
  'div.dfad', // thedomains.com
  'div.dfinder_cntr', // Hewlett Packard News
  'div#dfp-ad-mosad_1-wrapper', // The Hill
  'div#digital-editions', // The New Yorker
  'div#disqus', // ABCNews
  'div.editors-picks', // The Wall Street Journal
  'div.email-optin', // Quantstart
  'div#email-sign-up', // BBC
  'div.email-signup', // entrepeneur.com
  'div.encrypted-content', // Atlantic City Press
  'div.endslate', // WFMY News (final slide element)
  'div.entity_popular_posts', // Forbes
  'div.entity_preview', // Forbes
  'div.entity_recent_posts', // Forbes
  'div.entry-meta', // Re-code (uncertain about this one)
  'div#entry-tags', // hostilefork
  'div.entry-tags', // Wired.com
  'div.entry-unrelated', // The New Yorker
  'div#epilogue', // hostilefork
  'div#et-sections-dropdown-list', // The Washington Post
  'div.pane-explore-issues-topics', // MSNBC
  'div.feature_nav', // E-Week
  'div#features', // BBC News
  'div.followable_block', // Forbes
  'div.footer', // KMBC
  'div.gallery-sidebar-ad', // USA Today
  'div#gkSocialAPI', // The Guardian
  'div.googleads', // Telegraph UK
  'div.group-link-categories', // Symmetry Magazine
  'div.group-links', // Symmetry Magazine
  'div.gsharebar', // entrepeneur.com
  'div.headlines', // // The Oklahoman
  'div.headlines-images', // ABC 7 News
  'div.hide-for-print', // NobelPrize.org
  'div.ib-collection', // KMBC
  'div#infinite-list', // The Daily Mail
  'div.inline-sharebar', // CBS News
  'div.inline-share-tools-asset', // USA Today
  'div.inline-related-links', // Gourmet.com
  'div.inner-related-article', // Recode
  'div#inset_groups', // Gizmodo
  'div.issues-topics', // MSNBC
  'div[itemprop="comment"]',// KMBC
  'div#jp-relatedposts', // IT Governance USA
  'div.LayoutSocialTools', // ecdc.europa.eu
  'div.LayoutTools', // ecdc.europa.eu
  'div#leader', // hostilefork
  'div.linearCalendarWrapper', // ABC News
  'div.link-list-inline', // Las Vegas Sun
  'div#livefyre-wrapper', // The Wall Street Journal
  'div.ljcmt_full', // LiveJournal
  'div.ljtags', // LiveJournal
  'div.load-comments', // entrepeneur.com
  'div.l-sidebar', // TechSpot
  'div.l-story-secondary', // Boston.com
  'div.m-article__share-buttons', // The Verge
  'div.mashsharer-box', // internetcommerce.org
  'div.m-entry__sidebar', // The Verge
  'div.menu', // CNBC
  'div.meta_bottom', // Collegian
  'div#meta-related', // Entertainment Weekly
  'div#mc_embed_signup', // stgeorgeutah.com
  'div.m-linkset', // The Verge
  'div.middle-ads', // The Times
  'div.mla_cite', // NobelPrize.org
  'div.mmn-link', // ABC 7 News
  'div#most-popular', // BBC
  'div#mostPopularTab', // Reuters
  'div#most-read-news-wrapper', // The Daily Mail
  'div#mostSharedTab', // Reuters
  'div#most-watched-videos-wrapper', // The Daily Mail
  'div.multiplier_story', // Christian Science Monitor
  'div.nav', // KMBC (note: may be problematic)
  'div#newsletterList', // E-Week
  'div#newsletter_signup_article', // People Magazine
  'div.newsreel', // The Wall Street Journal
  'div.next_on_news', // BuzzFeed
  'div#nlHeader', // E-Week
  'div.node-footer', // Drupal
  'div.node-metainfo', // The Boston Herald
  'div.overlayPostPlay', // The Sydney Morning Herald
  'div.page_label', // Hewlett Packard News
  'div.pb-f-page-comments', // Washington Post
  'div.pfont', // Newsday
  'div.pl-most-popular', // entrepeneur.com
  'div.postcats', // The Wall Street Journal (blog)
  'div.post-comments', // The Sun Times
  'div.post-meta-category', // Comic Book Resources
  'div.post-meta-share', // Comic Book Resources
  'div.post-meta-tags', // Comic Book Resources
  'div.post-meta-taxonomy-terms', // The Sun Times
  'div#prevnext', // hostilefork
  'div.printad', // North Jersey
  'div.printHide', // Telegraph UK
  'div.printstory', // North Jersey
  'div#prologue', // hostilefork
  'div.pull-right', // The Oklahoman
  'div#reader-comments', // The Daily Mail
  'div.recirculation', // New Yorker
  'div#registration-notice', // Atlantic City Press
  'div#related', // The Boston Globe (note: wary of using this)
  'div.related', // CNBC (note: wary of using this one)
  'div.related-carousel', // The Daily Mail
  'div.related-block', // auburnpub.com
  'div.related-block2', // St. Louis Today
  'div.related-column', // The Hindu
  'div.related-items', // BBC
  'div#related_items', // Business Week
  'div#relatedlinks', // ABC News
  'div.related-media', // Fox News
  'div.relatedNews', // Tampa Bay
  'div.related-posts-inner', // threatpost.com
  'div.relatedRail', // Reuters
  'div#related-services', // BBC
  'div#related-tags', // St. Louis Today
  'div#relatedTopics', // Reuters
  'div.relatedTopicButtons', // Reuters
  'div#related-videos-container', // E-Online
  'div.relatedVidTitle', // E-Online
  'div.rel-block-news', // The Hindu
  'div.rel-block-sec', // The Hindu
  'div.relposts', // TechCrunch
  'div#respond', // Stanford Law
  'div#reveal-comments', // Aeon Magazine
  'div#right-column', // The Hindu
  'div.right_rail_cnt', // Hewlett Packard News
  'div#rn-section', // Getty
  'div#rt_contact', // CNBC
  'div#rt_featured_franchise', // CNBC
  'div#rt_primary_1', // CNBC
  'div[id^="rt_promo"]', // CNBC
  'div#rt_related_0', // CNBC
  'div.resizer', // KMBC
  'div.save-tooltip', // auburnpub
  'div.sd-social', // Re-code
  'div#section-comments',  // The Washington Post
  'div#section-kmt', // The Guardian
  'div.section-puffs', // Telegraph UK
  //'div.share', // CANNOT USE
  'div.share > div.right', // auburnpub.com

  'div.shareArticles', // The Daily Mail
  'div.share-bar', // Gulf News
  'div.share-body-bottom', // BBC
  'div.share-buttons', // Quantstart
  'div.share-count-container', // CNBC
  'div.sharedaddy', // Fortune
  'div.share-help', // BBC
  'div.shareLinks', // Reuters
  'div.sharetools-inline-article-ad', // NYTimes
  'div.shareToolsNextItem', // KMBC
  'div.sharrre-container', // Concurring Opinions
  'div.show-related-videos', // CBS News
  'div.sidebar-content', // Concurring opinions
  'div.sidebar-feed', // WRAL
  'div.simpleShare', // Newsday
  'div.sitewide-footer', // NBCNews
  'div.sitewide-header-content', // NBCNews
  'div.social', // BBC
  'div.social-actions', // BuzzFeed
  'div.socialbar', // Autonews
  'div.social-bar', // The Miami Herald
  'div.social-bookmarking-module', // Wired.com
  'div.social-buttons', // The Verge
  'div.social-column', // TechSpot
  'div.social-count', // Fox News
  'div.social-dd', // The Wall Street Journal
  'div.social_icons', // Forbes
  'div#social-links', // Reuters
  'div.social-links-bottom', // MSNBC
  'div.social-links-top', // MSNBC
  'div#social-share', // Priceonomics
  'div.social-share', // Bloomberg
  'div.social-share-top', // Priceonomics
  'div.social-share-bottom', // The Hill
  'div.social-toolbar', // News OK
  'div.social-toolbar-affix', // News OK
  'div.social-tools-wrapper-bottom ', // Washington Post
  'div.sps-twitter_module', // BBC
  'div#sticky-nav', // Christian Science Monitor
  'div.sticky-tools', // The Boston Globe
  'div#storyControls', // Politico
  'div#story-embed-column', // Christian Science Monitor
  'div#story-footer', // The Miami Herald
  'div.story_list', // Christian Science Monitor
  'div#storyMoreOnFucntion', // Telegraph UK
  'div.storynav', // TechCrunch
  'div#story_right_column_ad', // dailyjournal.net
  'div.story-tags', // Fox Sports
  'div.story-taxonomy', // ABC Chicago
  'div.storytools', // TechCrunch
  'div#subscription-notice', // Atlantic City Press
  'div#tabs-732a40a7-tabPane-2', // The Miami Herald (unclear)
  'div.talklinks', // LiveJournal
  'div.taxonomy', // ABC Chicago
  'div.t_callout', // ABC News
  'div#teaserMarketingCta', // The Times
  'div#teaser-overlay', // The Times
  'div.thirdPartyRecommendedContent', // KMBC
  'div#thumb-scroller', // E-Week
  'div.tncms-restricted-notice', // Atlantic City Press
  'div.toolbox', // ABC News
  'div.tools1', // The Wall Street Journal (blog)
  'div.top-index-stories', // BBC
  'div.topkicker', // entrepreneur.com
  'div.top-stories-range-module', // BBC
  'div.top-stories05', // Telegraph UK
  'div.trb_embed_related', // LA Times
  'div.trb_panelmod_body', //  LA Times
  'div.twipsy', // St. Louis Today
  'div.util-bar-flyout', // USA Today
  'div.utilities', // The Times
  'div#utility', // WRAL
  'div.utility-bar', // USA Today
  'div.utility-panels', // WRAL
  'div.utilsFloat', // KMBC
  'div.video_about_ad', // Christian Science Monitor
  'div.video_disqus', // Bloomberg
  'div#video-share', // ABC News
  'div.view-comments', // auburnpub.com
  'div#vuukle_env', // The Hindu
  'div#WNCol4', // Fox (subsidary myfoxny.com)
  'div#WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
  'div.xwv-related-videos-container', // The Daily Mail
  'div#you-might-like', // The New Yorker
  'div#zergnet', // Comic Book Resources
  'figure.ib-figure-ad', // KMBC
  'figure.kudo', // svbtle.com blogs
  'footer', // any
  'header', // any
  'h2.hide-for-print', // NobelPrize.org
  'h2#page_header', // CNBC
  'h3#scrollingArticlesHeader', // The Oklahoman
  'h4.taboolaHeaderRight', // KMBC
  'img#ajax_loading_img', // E-Week
  'li#mostPopularShared_0', // Reuters
  'li#mostPopularShared_1', // Reuters
  'li#pagingControlsPS', // neagle
  'li#sharetoolscontainer', // neagle
  'ol[data-vr-zone="Around The Web"]', // The Oklahoman
  'nav', // any
  'p.authorFollow', // The Sydney Morning Herald
  'p.essay-tags', // Aeon Magazine
  'p.moreVideosTitle', // E-Online
  'p.p_top_10', // Star Telegram
  'p.story-ad-txt', // Boston.com
  'p.storytag', // chinatopix.com
  'p.trial-promo', // Newsweek
  'section.around-bbc-module', // BBC
  'section.bottom_shares', // BuzzFeed
  'section.breaking_news_bar', // Bloomberg
  'section#comments', // TechSpot
  'section.comments', // ABC Chicago
  'section#follow-us', // BBC
  'section.headline-list', // The Miami Herald
  'section.headlines-list', // ABC Chicago
  'section#more-stories-widget', // The Miami Herald
  'section#newsletter-signup', // New Yorker
  'section#promotions', // The New Yorker
  'section#related-links', // BuzzFeed
  'section.related-products', // TechSpot
  'section#responses', // BuzzFeed
  'section.signup-widget', // The Miami Herald
  'section.story-tools-mod', // Boston.com
  'section.suggested-links', // The Examiner
  'section.top-video', // ABC 7 News
  'span.sharetools-label', // NY Time
  'table.complexListingBox', // Mercury News
  'ul.article-options', // TVNZ
  'ul#article-share-links', // The Boston Herald
  'ul.blox-recent-list', // Atlantic City Press
  'ul.breadcrumb', // The Miami Herald
  'ul.breaking-news-stories', // ABC 7 News
  'ul.entry-extra', // Wired Magazine
  'ul.entry_sharing', // Bloomberg
  'ul.flippy', // MSNBC
  'ul.generic_tabs', // Bloomberg
  'ul.links--inline', // Drupal
  'ul.links-list', // BBC
  'ul.navbar-nav', // Noctua Software Blog
  'ul.nav-tabs', // The Miami Herald
  'ul.newslist', // Autonews
  'ul.pagenav', // The Guardian
  'ul.pagination', // Politico
  'ul.related-links', // The Boston Globe
  'ul.related-posts', // Concurring Opinions
  'ul.social', // The Sydney Morning Herald
  'ul.social-bookmarking-module', // Wired Magazine
  'ul.socialByline', // The Wall Street Journal (blog)
  'ul.socials', // independent.ie
  'ul.social-share-list', // TechCrunch
  'ul.social-tools', // The Washington Post
  'ul.tags', // BBC
  'ul.thumbs', // NY Daily News
  'ul#toolbar-sharing', // UT San Diego
  'ul.tools', // The Syndey Morning Herald
  'ul#topics', // Yahoo News
  'ul.utility-list'// WRAL
];

/**
 * An element's score is biased according to the type of the element. Certain
 * elements are more or less likely to contain boilerplate. The focus here
 * is not assessing whether each element contains boilerplate or not, but how
 * likely could the elementy type serve as the target element.
 */
var INTRINSIC_BIAS = new Map([
  ['main', 100],
  ['section', 50],
  ['blockquote', 10],
  ['code', 10],
  ['content', 200],
  ['div', 10],
  ['figcaption', 10],
  ['figure', 10],
  ['ilayer', 10],
  ['layer', 10],
  ['p', 10],
  ['pre', 10],
  ['ruby', 10],
  ['summary', 10],
  ['a', -5],
  ['address', -5],
  ['dd', -5],
  ['dt', -5],
  ['h1', -5],
  ['h2', -5],
  ['h3', -5],
  ['h4', -5],
  ['h5', -5],
  ['h6', -5],
  ['small', -5],
  ['sub', -5],
  ['sup', -5],
  ['th', -5],
  ['form', -20],
  ['li', -50],
  ['ol', -50],
  ['ul', -50],
  ['font', -100],
  ['aside', -100],
  ['header', -100],
  ['footer', -100],
  ['table', -100],
  ['tbody', -100],
  ['thead', -100],
  ['tfoot', -100],
  ['nav', -100],
  ['tr', -500]
]);

/**
 * Immediate parents of these elements receive a bias for containing these
 * elements. For example, a <div> that contains several <p>s receives a
 * very positive bias, because that <div> is more likely to be the target
 */
var DESCENDANT_BIAS = new Map([
  ['a', -5],
  ['blockquote', 20],
  ['div', -50],
  ['h1', 10],
  ['h2', 10],
  ['h3', 10],
  ['h4', 10],
  ['h5', 10],
  ['h6', 10],
  ['li', -5],
  ['ol', -20],
  ['p', 30],
  ['pre', 10],
  ['ul', -20]
]);

/**
 * Each element receives a bias according to the values of its attributes, such
 * as its id, class, name, itemtype, itemprop, and role. These are individual,
 * lowercase tokens that are generally found in the attribute values. They
 * are written to match up to the tokens generated by splitting using
 * RE_TOKEN_DELIMITER.
 */
var ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -200],
  ['artext1',100],
  ['article', 200],
  ['articles', 100],
  ['articlecontent', 1000],
  ['articlecontentbox', 200],
  ['articleheadings', -50],
  ['articlesection', 200],
  ['articlesections', 200],
  ['attachment', 20],
  ['author', 20],
  ['block', -5],
  ['blog', 20],
  ['blogposting', 500],
  ['body', 100],
  ['bodytd', 50],
  ['bookmarking', -100],
  ['bottom', -100],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['cmt', -100],
  ['cmmt', -100],
  ['colophon', -100],
  ['column', 10],
  ['combx', -20],
  ['comic', 75],
  ['comment', -500],
  ['comments', -300],
  ['commercial', -500],
  ['community', -100],
  ['component', -50],
  ['contact', -50],
  ['content', 100],
  ['contenttools', -50],
  ['contributors', -50],
  ['credit', -50],
  ['date', -50],
  ['dcsimg', -100],
  ['dropdown', -100],
  ['email', -100],
  ['entry', 100],
  ['excerpt', 20],
  ['facebook', -100],
  ['featured', 20],
  ['fn', -30],
  ['foot', -100],
  ['footer', -200],
  ['footnote', -150],
  ['ftr', -100],
  ['ftrpanel', -100],
  ['google', -50],
  ['gutter', -300],
  ['guttered', -100],
  ['head', -50],
  ['header', -100],
  ['heading', -50],
  ['hentry', 150],
  ['inset', -50],
  ['insta', -100],
  ['left', -75],
  ['legende', -50],
  ['license', -100],
  ['like', -100],
  ['link', -100],
  ['links', -100],
  ['logo', -50],
  ['main', 50],
  ['mainbodyarea', 100],
  ['maincolumn', 50],
  ['mainnav', -500],
  ['mainnavigation', -500],
  ['masthead', -30],
  ['media', -100],
  ['mediaarticlerelated', -50],
  ['menu', -200],
  ['menucontainer', -300],
  ['meta', -50],
  ['most', -50],
  ['nav', -200],
  ['navbar', -100],
  ['navigation', -100],
  ['navimg', -100],
  ['newsarticle', 500],
  ['newsletter', -100],
  ['page', 50],
  ['pagetools', -50],
  ['parse', -50],
  ['pinnion', 50],
  ['popular', -50],
  ['popup', -100],
  ['post', 100],
  ['power', -100],
  ['print', -50],
  ['promo', -200],
  ['promotions', -200],
  ['ranked', -100],
  ['reading', 100],
  ['recap', -100],
  ['recreading', -100],
  ['rel', -50],
  ['relate', -300],
  ['related', -300],
  ['relposts', -300],
  ['replies', -100],
  ['reply', -50],
  ['retweet', -50],
  ['right', -100],
  ['rightcolumn', -100],
  ['rightrail', -100],
  ['scroll', -50],
  ['share', -200],
  ['sharebar', -200],
  ['shop', -200],
  ['shout', -200],
  ['shoutbox', -200],
  ['side', -200],
  ['sig', -50],
  ['signup', -100],
  ['snippet', 50],
  ['social', -200],
  ['socialnetworking', -250],
  ['socialtools', -200],
  ['source',-50],
  ['sponsor', -200],
  ['story', 100],
  ['storydiv',100],
  ['storynav',-100],
  ['storytext', 200],
  ['storytopbar', -50],
  ['storywrap', 50],
  ['strycaptiontxt', -50],
  ['stryhghlght', -50],
  ['strylftcntnt', -50],
  ['stryspcvbx', -50],
  ['subscribe', -50],
  ['summary',50],
  ['tabs', -100],
  ['tag', -100],
  ['tagcloud', -100],
  ['tags', -100],
  ['teaser', -100],
  ['text', 20],
  ['this', -50],
  ['time', -30],
  ['timestamp', -50],
  ['title', -50],
  ['tool', -200],
  ['toptabs', -200],
  ['twitter', -200],
  ['txt', 50],
  ['utility', -50],
  ['vcard', -50],
  ['week', -100],
  ['welcome', -50],
  ['widg', -200],
  ['widget', -200],
  ['zone', -50]
]);

}(this));
