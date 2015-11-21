// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const BlacklistFilter = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Remove blacklisted elements.


// To reduce the number of 
// calls to matches, we store a separate simpler set of element 
// names and just do set.has for those before calling matches.

BlacklistFilter.transform = function(document, rest) {

  // This uses NodeIterator because of how the traversal intelligently
  // avoids visiting detached subtrees, which leads to fewer mutations
  // The counter issue is that this results in a greater number 
  // of calls to Element.prototype.matches. 


  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_ELEMENT);
  let element = iterator.nextNode();
  while(element) {
    if(BLACKLIST_LOCAL_NAMES.has(element.localName)) {
      element.remove();
    } else if(isBlacklistedAnchorClass(element)) {
      element.remove();
    } else if(isBlacklistedDivClass(element)) {
      element.remove();
    } else if(element.matches(JOINED_BLACKLIST_SELECTORS)) {
      element.remove();
    }
    element = iterator.nextNode();
  }
};


// Elements that are explicitly blacklisted. This is kept in a 
// separate shorter list for faster lookup and to reduce the 
// call to matches in the removeBlacklistedElements function
const BLACKLIST_LOCAL_NAMES = new Set([
  'applet',
  'base',
  'basefont',
  'bgsound',
  'button',
  'command',
  'datalist',
  'dialog',
  'embed',
  'fieldset',
  'footer',
  'frameset',
  'head',
  'header',
  'hr',
  'iframe',
  'input',
  'isindex',
  'link',
  'math',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'object', 
  'output',
  'option',
  'optgroup',
  'param',
  'progress',
  'script',
  'select',
  'spacer',
  'style',
  'textarea',
  'title',
  'video',
  'xmp'
]);

const BLACKLIST_ANCHOR_CLASSES = [
  'advertise-with-us', // The Daily Voice
  'aggregated-rel-link', // The Oklahoman
  'bylineCommentCount', // Pasadena Star News
  'carousel-control', // The Miami Herald
  'commentLink', // Salt Lake Tribune
  'comments', // Good Magazine
  'detail-newsletter-trigger', // The Daily Voice
  'dsq-brlink', // USA Today
  'enlargebtn', // NPR
  'hdn-analytics', // SF Gate
  'image-component__pinterest', // Huffington Post
  'meta-comments', // Windows Central
  'modal-trigger', // NY Post
  'more-tab', // The Oklahoman
  'nextPageLink', // Salt Lake Tribune
  'post_cmt1', // Times of India
  'readmore-link', // Topix
  'sm-link', // hanselman.com (social media link)
  'twitter-follow-button', // Ha'Aretz
  'twitter-share-button', // The Jewish Press
  'twitter-timeline', // Newsday
  'synved-social-button', // Viral Global News
  'skip-to-text-link' // NYTimes
];

function isBlacklistedAnchorClass(element) {
  if(element.localName === 'a') {
    const classList = element.classList;
    const numClasses = BLACKLIST_ANCHOR_CLASSES.length;
    for(let i = 0; i < numClasses; i++) {
      const className = BLACKLIST_ANCHOR_CLASSES[i];
      if(classList.contains(className)) {
        return true;
      }
    }
  }

  return false;
}

// This array is under dev. Remove div. prefix, implement
// isBlacklistedDivClass, add into transform, move rest of 
// div classes out of general array

const BLACKLIST_DIV_CLASSES = [
  'about-the-author', // SysCon Media
  'actions-panel', // SysCon Media
  'ad', // Reuters
  'adAlone300', // The Daily Herald
  'adarea', // Telegraph
  'ad-cluster-container', // TechCrunch
  'ad-container', // Fox News
  'additional-stories', // Vanity Fair
  'addthis_toolbox', // NobelPrize.org
  'addtoany_share_save_container', // Global Dispatch
  'adCentred', // The Sydney Morning Herald
  'ad-item', // hanselman.com
  'adjacent-entry-pagination', // thedomains.com
  'ad-marketplace-horizontal', // popularmechanics.com
  'admpu', // Telegraph UK
  'ads-box', // hanselman.com
  'adsense', // Renew Economy
  'ad-unit', // TechCrunch
  'advertisementPanel', // TV New Zealand
  'am-ctrls', // Investors.com
  'appeal-newsletter', // scpr.org
  'art_tabbed_nav', // The Wall Street Journal (blog)
  'articleAutoFooter', // NECN
  'article_actions', // Forbes
  'article-actions', // Ottawa Citizen
  'article_cat', // Collegian
  'article_comments', // Voice of America
  'article-comments', // Times of India
  'articleComments', // Reuters
  'article-conclusion-sharing', // scpr.org
  'article-social', // Fortune Magazine
  'articleEmbeddedAdBox', // Mercury News
  'article-extra', // TechCrunch
  'article-footer', // Windows Central
  'article_footer', // Bloomberg
  'article_interaction', // Bloomberg
  'article-list', // // The Oklahoman
  'articleMeta', // Tampa Bay
  'articleOptions', // Mercury News
  'article-pagination', // UT San Diego
  'article-print-url', // USA Today
  'articleRelates', // Baltimore Sun
  'articleServices', // Ha'Aretz
  'articleShareBottom', // Fox Sports
  'article-side', // The Times
  'article_share', // NBC News
  'article_social', // Bloomberg
  'article-social-actions', // Windows Central
  'articleSponsor', // Telegraph Co Uk
  'article-tags', // entrepeneur.com
  'article-tips', // 9News
  'articleTools', // Reuters
  'article-tools', // The Atlantic
  'article-tools-horizontal', // Wharton Knowledge Blog
  'article-utilities', // Sports Illustrated
  'articleViewerGroup', // Mercury News
  'artOtherNews', // Investors.com
  'aside-related-articles', // Techcrunch
  'assetBuddy', // Reuters
  'at-con', // Design & Trend
  'at-next', // Design & Trend
  'at-tag', // Design & Trend
  'at-tool', // Design & Trend
  'author_topics_holder', // The Irish Times
  'author-wrap', // Recode
  'author-info', // Streetwise
  'big_story_tools_bottom_container', // Alternet
  'bio-socials', // Atomic Object
  'bizPagination', // Bizjournal
  'bk-socialbox', // Latin Post
  'bk-relart', // Latin Post
  'bookmarkify', // Kamens Blog
  'bottom_subscribe', // Alternet
  'bpcolumnsContainer', // Western Journalism
  'breadcrumbs', // Scientific American
  'breadcrumb_container', // NBC News
  'browse', // ABC News
  'bt-links', // Learning and Finance
  'buying-option', // Times of India
  'byline', // Misc, but the only way to identify Autonews
  'byline_links', // Bloomberg
  'bylineSocialButtons', // Telegraph Co Uk
  'byline-wrap', // The Wall Street Journal
  'card-stats', // WFPL
  'category-nav', // Sparkfun
  'cmtLinks', // India Times
  'cnn_strybtntools', // CNN
  'cnn_strylftcntnt', // CNN
  'cnn_strycntntrgt', // CNN
  'cn_reactions_comments', // Vanity Fair
  'commentCount', // Reuters
  'comment-count', // auburnpub.com
  'comment-count-block',// TechSpot
  'comment_count_affix', // // The Oklahoman
  'commentDisclaimer', // Reuters
  'comment-holder', // entrepeneur.com
  'comment_bug', // Forbes
  'CommentBox', // LWN
  'comments', // TechCrunch
  'comments-box', // Freakonomics
  'comments-component', // Huffington Post
  'commentThread', // kotatv
  'comment-tools', // Latin post
  'comment_links', // Forbes
  'comments-overall', // Aeon Magazine
  'comment-policy-box', // thedomains.com
  'commentWrap', // Corcodillos
  'component-share', // Sports Illustrated
  'content_column2_2', // VOA News
  'content-tools', // Time Magazine
  'contribution-stats-box', // Knight News Challenge
  'control-bar', // SF Gate
  'controls', // NY Daily News
  'correspondant', // CBS News
  'correspondent-byline', // BBC Co Uk
  'cqFeature', // Vanity Fair
  'css-sharing', // Topix
  'deep-side-opinion', // The Australian
  'dfad', // thedomains.com
  'dfinder_cntr', // Hewlett Packard News
  'dmg-sharing', // Dispatch.com
  'edit-link', // theweek.com
  'editorsChoice', // Telegraph Co Uk
  'editorsPick', // India Times
  'editors-picks', // The Wall Street Journal
  'email-optin', // Quantstart
  'email-signup', // entrepeneur.com
  'embedded-hyper', // BBC
  'encrypted-content', // Atlantic City Press
  'endslate', // WFMY News (final slide element)
  'entity_popular_posts', // Forbes
  'entity_preview', // Forbes
  'entity_recent_posts', // Forbes
  'entry-listicles', // CBS
  'entry-meta', // Re-code (uncertain about this one)
  'entry-related', // The Globe
  'extra-services', // ARXIV
  'entry-tags', // Wired.com
  'entry-toolbar', // CBS
  'entry-unrelated', // The New Yorker
  'essb_links', // Beta Wired
  'fb-content', // The Week
  'fblike', // Ha'Aretz
  'feature-btns', // USA Today (assumes video not supported)
  'feature_nav', // E-Week
  'field-name-field-tags', // WFPL
  'first-tier-social-tools', // Time Magazine
  'floating-share-component', // Huffington Post
  'followable_block', // Forbes
  'follow-authors', // Politico
  'follow-us', // Fox News
  'follow-us-component', // Huffington Post
  'follow-us-below-entry-component', // Huffington Post
  'footer', // KMBC
  'googleads', // Telegraph UK
  'group-link-categories', // Symmetry Magazine
  'group-links', // Symmetry Magazine
  'gsharebar', // entrepeneur.com
  'footerlinks', // VOA News
  'further-reading', // ProPublica
  'gallery-sidebar-ad', // USA Today
  'gallery-overlay-outter', // SF Gate
  'hashtags', // Good Magazine
  'headlines', // // The Oklahoman
  'headlines-images', // ABC 7 News
  'hide-for-print', // NobelPrize.org
  'horiz_con', // ABC22NOW
  'hst-articlefooter', // Chron.com
  'hst-articletools', // Chron.com
  'hst-blockstates', // Stamford Advocate (may be problematic)
  'hst-featurepromo', // Seattle Pi
  'hst-freeform', // Chron.com
  'hst-headlinelist', // Chron.com
  'hst-hottopics', // Chron.com
  'hst-modularlist', // Chron.com
  'hst-morestories', // Chron.com
  'hst-mostpopular', // Seattle Pi
  'hst-newsgallery', // Stamford Advocate
  'hst-othernews', // Stamford Advocate
  'hst-relatedlist', // Seattle Pi
  'hst-simplelist', // Chron.com
  'hst-siteheader', // Seattle Pi
  'hst-slideshowpromo', // Seattle Pi
  'htzTeaser', // Ha'Aretz
  'huffpost-adspot', // Huffington Post
  'huffpost-recirc', // Huffington Post
  'ib-collection', // KMBC
  'icons', // Brecorder
  'icons_inner', // Ahram
  'inline-sharebar', // CBS News
  'inline-share-tools-asset', // USA Today
  'inline-related-links', // Gourmet.com
  'inner-related-article', // Recode
  'insettwocolumn', // NPR
  'insideStoryAd', // Star Advertiser
  'interactive-sponsor', // USA Today
  'issues-topics', // MSNBC
  'item-footer', // hanselman.com
  'item-prevnext', // hanselman.com
  'j_social_set', // MSNBC (embedded share links)
  'latest-stories', // Vanity Fair
  'LayoutSocialTools', // ecdc.europa.eu
  'LayoutTools', // ecdc.europa.eu
  'lhs_relatednews', // NDTV
  'like-share', // Bangkok Post
  'likeus', // Good Magazine
  'linearCalendarWrapper', // ABC News
  'link-list-inline', // Las Vegas Sun
  'ljcmt_full', // LiveJournal
  'ljtags', // LiveJournal
  'load-comments', // entrepeneur.com
  'l-sidebar', // TechSpot
  'l-story-secondary', // Boston.com
  'k-g-share', // bbc.co.uk
  'main_social', // Times of India
  'marginal-tools', // scpr.org
  'm-article__share-buttons', // The Verge
  'mashsharer-box', // internetcommerce.org
  'm-entry__sidebar', // The Verge
  'meta_bottom', // Collegian
  'meta-container', // Gawker
  'm-linkset', // The Verge
  'middle-ads', // The Times
  'minipoll', // Topix
  'mla_cite', // NobelPrize.org
  'mmn-link', // ABC 7 News
  'mobile-button', // Ha'Aretz
  'modComments', // Investors.com
  'module__biz-pulse', // Bizjournal
  'mod-video-playlist', // ESPN
  'more-single', // USA Today
  'moreweb', // Uptown Magazine
  'most-popular', // Vanity Fair
  'most-popular-container', // The Atlantic
  'mostPopular', // Newsday
  'mTop15', // Times of India
  'multiplier_story', // Christian Science Monitor
  'nav', // KMBC (note: may be problematic)
  'navigation', // Renew Economy (may be problematic)
  'newsletterSignupBox', // NBC
  'newsreel', // The Wall Street Journal
  'next_on_news', // BuzzFeed
  'nhlinkbox', // PBS
  'node-footer', // Drupal
  'node-metainfo', // The Boston Herald
  'NotifyUserBox', // Bangkok Post
  'npRelated', // National Post
  'NS_projects__project_share', // Kickstarter
  'oembed-asset', // USA Today
  'Other-stories', // Bangkok Post
  'overlayPostPlay', // The Sydney Morning Herald
  'page_label', // Hewlett Packard News
  'page-navigation', // Misc.
  'page-tools', // Channel News Asia
  'pagination', // Investors.com
  'paging_options', // Alternet
  'pane-explore-issues-topics', // MSNBC
  'par-y_rail', // Vanity Fair
  'pb-f-page-comments', // Washington Post
  'pfont', // Newsday
  'pin-it-btn-wrapper', // US Prison Culture
  'pl-most-popular', // entrepeneur.com
  'pnnavwrap', // NPR (previous/next article links wrapper)
  'post-actions', // WorldNetDaily
  'postcats', // The Wall Street Journal (blog)
  'postcommentpopupbox', // Times of India
  'post-comments', // The Sun Times
  'post-links', // Pro Football Talk
  'postmeta', // Windows Central
  'post-meta-category', // Comic Book Resources
  'post-meta-share', // Comic Book Resources
  'post-meta-tags', // Comic Book Resources
  'post-meta-taxonomy-terms', // The Sun Times
  'postnav', // Freakonomics
  'post-share-buttons', // Blogspot
  'post-social-iteration-wrapper', // Streetwise
  'posts-stories', // Ha'Aretz
  'post-tags', // Teleread
  'post-tools-wrapper', // Gawker
  'post-wrap-side-share', // PBS
  'premium-box', // Foreign Affairs
  'primaryContent3', // Reuters (NOTE: I dislike this one)
  'printad', // North Jersey
  'printHide', // Telegraph UK
  'printstory', // North Jersey
  'promo-inner', // Chron.com
  'promo-top', // Chron.com
  'pull-left-tablet', // NY1 (only uses "article" for related)
  'raltedTopics', // India Times
  'read_more', // Times of India
  'recirculation', // New Yorker
  'recommended-articles-wrap', // Vice.com
  'recommended-links', // The Appendix
  'region-content-embed', // The Hill
  'region-content-inside', // The Hill
  'related', // CNBC (note: wary of using this one)
  'related_articles', // Ahram
  'related-carousel', // The Daily Mail
  'related-block', // auburnpub.com
  'related-block2', // St. Louis Today
  'related-column', // The Hindu
  'related_content', // Bizjournal
  'related-items', // BBC
  'related_items', // NY Books
  'related-links', // Boston.com
  'related-links-container', // Business Insider
  'related-media', // Fox News
  'relatedModule', // Newsday
  'relatedNews', // Tampa Bay
  'related-posts', // Buzzcarl
  'related-posts-inner', // threatpost.com
  'relatedRail', // Reuters
  'relateds', // CS Monitor
  'relatedStories', // Salt Lake Tribute
  'related-tags', // CBS
  'relatedTopicButtons', // Reuters
  'related-vertical', // The Wrap
  'relatedVidTitle', // E-Online
  'rel-block-news', // The Hindu
  'rel-block-sec', // The Hindu
  'relposts', // TechCrunch
  'resizer', // KMBC
  'right_rail_cnt', // Hewlett Packard News
  'rtCol', // Time Magazine
  'save-tooltip', // auburnpub
  'sc_shareTools', // ABC News
  'sd-social', // Re-code
  'second-tier-social-tools', // Time Magazine
  'section-puffs', // Telegraph UK
  'shareArticles', // The Daily Mail
  'share-bar', // Gulf News
  'sharebar', // NY Post
  'share-body-bottom', // BBC
  'share-btn', // Christian Times
  'share-buttons', // Quantstart
  'share-container', // Business Insider
  'share-count-container', // CNBC
  'sharedaddy', // Fortune
  'share-help', // BBC
  'share_inline_header', // The Economist
  'share_inline_footer', // The Economist
  'share-items', // Vanity Fair
  'share-link-inline', // Sparkfun
  'shareLinks', // Reuters
  'share-module', // popularmechanics.com
  'share-module--count', // popularmechanics.com
  'sharetools-inline-article-ad', // NYTimes
  'shareToolsNextItem', // KMBC
  'sharingBox', // India Times
  'sharrre-container', // Concurring Opinions
  'shortcode-post', // ABC7 News
  'show-related-videos', // CBS News
  'show-share', // The Atlantic
  'sidebar', // Belfast Telegraph
  'sideBar', // Bangkok Post
  'sidebar1', // local12
  'sidebar2', // local12
  'sidebar-content', // Concurring opinions
  'sidebar-feed', // WRAL
  'side-news-area', // Channel News Asia
  'simpleShare', // Newsday
  'single-author', // Recode
  'single-related', // USA Today
  'sitewide-footer', // NBCNews
  'sitewide-header-content', // NBCNews
  'slideshow-controls', // Vanity Fair
  'small-rotator', // CTV News
  'social', // BBC
  'social-action', // Pakistan Daily
  'social-actions', // BuzzFeed
  'socialbar', // Autonews
  'socialBar', // Chron.com
  'social-bar', // The Miami Herald
  'social-bookmarking-module', // Wired.com
  'social-buttons', // The Verge
  'social-column', // TechSpot
  'social-count', // Fox News
  'social-dd', // The Wall Street Journal
  'sociable', // Mint Press
  'social_icons', // Forbes
  'social-links', // SF Gate
  'social-links-bottom', // MSNBC
  'social-links-top', // MSNBC
  'social-news-area', // Channel News Asia
  'socialNetworks', // NBC
  'social-share', // Bloomberg
  'social-share-top', // Priceonomics
  'social-share-bottom', // The Hill
  'social-toolbar', // News OK
  'social-toolbar-affix', // News OK
  'social-tools-wrapper-bottom', // Washington Post
  'spantab', // Times of India
  'SPOSTARBUST-Related-Posts', // RObservatory
  'sps-twitter_module', // BBC
  'srch_box', // Times of India
  'ssba', // Funker (social share button actions?)
  'ssb-share', // 365Solutions
  'stack-talent', // NBC News (author bio)
  'stack-video-nojs-overlay', // NBC News
  'staff_info', // Bizjournals
  'statements-list-container', // Topix
  'sticky-tools', // The Boston Globe
  'story-block--twitter', // 9News
  'story-comment', // Latin Post
  'story_comments', // Alternet
  'story-extras', // The Australian
  'story-footer', // The Australian
  'story-header-tools', // The Australian
  'story_list', // Christian Science Monitor
  'storynav', // TechCrunch
  'story_pagination', // ABC News
  'StoryShareBottom', // CTV News
  'story-share-buttons', // USA Today
  'story-tags', // Fox Sports
  'story-taxonomy', // ABC Chicago
  'story-toolbar', // Politico
  'storytools', // TechCrunch
  'story-tools', // Latin Post
  'story_tools_bottom', // Alternet
  'story-tools-wrap', // Charlotte Observer
  'submit-button', // Knight News Challenge
  'subnav-tools-wrap', // NPR
  'subscribe', // Times of India
  'supplementalPostContent', // Medium.com
  'tag-list', // NY Post (iffy on this one)
  'talklinks', // LiveJournal
  'taxonomy', // ABC Chicago
  't_callout', // ABC News
  'text-m-in-news', // The Australian
  'textSize', // CBS
  'thirdPartyRecommendedContent', // KMBC
  'three-up-list', // The Huffington Post
  'tncms-restricted-notice', // Atlantic City Press
  'toolbox', // ABC News
  'tools', // ABC News (risky, might be a content-tag)
  'tools1', // The Wall Street Journal (blog)
  'topic-category', // Bangkok Post
  'top-index-stories', // BBC
  'topkicker', // entrepreneur.com
  'toplinks', // VOA News
  'top-stories-range-module', // BBC
  'top-stories05', // Telegraph UK
  'trb_embed_related', // LA Times
  'trb_panelmod_body', //  LA Times
  'twipsy', // St. Louis Today
  'upshot-social', // The New York Times
  'util-bar-flyout', // USA Today
  'utilities', // The Times
  'utility-bar', // USA Today
  'utility-panels', // WRAL
  'utils', // kotatv
  'utilsFloat', // KMBC
  'video_about_ad', // Christian Science Monitor
  'video_disqus', // Bloomberg
  'view-comments', // auburnpub.com
  'wideheadlinelist2', // Chron.com
  'windows-phone-links', // Windows Central
  'wp_rp_wrap', // BuzzCarl (wordpress related post)
  'xwv-related-videos-container', // The Daily Mail
  'x-comment-menu', // Topix
  'x-comments-num', // Topix
  'x-comment-post-wrap', // Topix
  'yarpp-related' // Spoon-Tamago
];

function isBlacklistedDivClass(element) {
  if(element.localName === 'div') {
    const classList = element.classList;
    const numClasses = BLACKLIST_DIV_CLASSES.length;
    for(let i = 0; i < numClasses; i++) {
      const className = BLACKLIST_DIV_CLASSES[i];
      if(classList.contains(className)) {
        return true;
      }
    }
  }

  return false;
}



// NOTE: cannot use 'div.share'
// NOTE: cannot use 'article div.share' (Vanity Fair vs Concurring Opinions)
// NOTE: cannot use 'div.posts' (wordpress copyblogger theme)
// NOTE: cannot use 'div.menu' // CNBC
// NOTE: cannot use 'div.pull-right' (oklahoman vs nccgroup blog)

const BLACKLIST_SELECTORS = [
  'a[href^="http://ad.doubleclick"]', // Medium
  'a[href*="socialtwist"]', // The Jewish Press
  'a[rel="tag"]', // // The Oklahoman
  'article div.extra', // Washington Post
  'article > div.tags', // NPR
  'article ul.listing', // Good Magazine
  'aside.author-blocks', // ProPublica
  'aside.itemAsideInfo', // The Guardian
  'aside#asset-related', // St. Louis Today
  'aside.bg-related', // The Boston Globe
  'aside#bpage_ad_bottom', // BuzzFeed
  'aside[data-panelmod-type="relatedContent"]', // LA Times
  'aside.callout', // The Atlantic
  'aside.entry-sidebar', // The Globe
  'aside#fbookulous-flyer', // ProPublica
  'aside.global-magazine-recent', // Politico
  'aside.global-popular', // Politico
  'aside.inset-section',// Techcrunch
  'aside.karma', // Swissinfo.ch
  'aside.like-this', // ProPublica
  'aside.livefyre-comments', // Vanity Fair
  'aside.meta_extras', // Japan Times
  'aside.marginalia', // NY Times
  'aside.mashsb-container', // cryptocoinsnews.com
  'aside.module-2013-follow', // ProPublica
  'aside.module-tabbed-2011', // ProPublica
  'aside#post_launch_success', // BuzzFeed
  'aside.prev-next', // The Economist
  'aside.referenced-wide', // Gawker
  'aside.related-articles', // BBC
  'aside.related-content', // // The Oklahoman
  'aside#related-content-xs', // The Miami Herald
  'aside.related-side', // NY Magazine
  'aside.right-rail-module', // Time
  'aside#secondary-rail', // Dispatch.com
  'aside.see-also', // The Root
  'aside#sidebar', // TechSpot
  'aside#sidebar-read-more', // USA Today
  'aside.slickshare', // ProPublica
  'aside.social-stack', // ProPublica
  'aside#story-related-topics', // AV Web
  'aside.story-right-rail', // USA Today
  'aside.story-supplement', // Politico
  'aside.tools', // The Boston Globe
  'aside.vestpocket', // Forbes
  'aside.views-tags', // BuzzFeed
  'aside.widget-area', // thedomains.com
  'b.toggle-caption', // NPR
  'fb\\:comments',
  'div#a-all-related', // New York Daily News
  'div#addshare', // The Hindu
  'div[aria-label="+1 this post"]', // Google Plus
  'div.artbody > div.share', // China Topix
  'div.article div.columnsplitter', // CTV News
  'div#article div.share', // timeslive.co.za
  'div.article div.short-url', // Politico
  'div.article div.tags', // Politico
  'div.article div#media', // Newsday
  'div#article_comments', // Fort Worth Star Telegram
  'div#articleIconLinksContainer', // The Daily Mail
  'div[data-vr-zone="You May Like"]', // Voice of America
  'div#articleKeywords', // The Hindu
  'div#articlepagerreport', // Chron.com
  'div.article-text div.fullArticle', // Intl Business Times UK
  'div#authorarea', // Global Dispatch
  'div#author-byline', // NY Post
  'div[data-ng-controller="bestOfMSNBCController"]', // MSNBC
  'div#blq-foot', // BBC
  'div#block-disqus-disqus_comments', // Foreign Affairs
  'div#block-fa-cfrlatest', // Foreign Affairs
  'div#block-fa-related', // Foreign Affairs
  'div#blog-sidebar', // Comic Book Resources
  'div#blox-breadcrumbs', // Joplin
  'div#blox-comments', // National Standard
  'div#blox-footer', // Joplin
  'div#blox-header', // Joplin
  'div#blox-right-col', // Joplin
  'div#blox-breadcrumbs', // Joplin
  'div#bottom-rail', // Vanity Fair
  'div#breadcrumb', // Autonews
  'div#breadcrumbs', // E-Week
  'div[bucket-id="most_popular_01"]', // Telegraph/Reuters
  'div[bucket-id="secondary_navigation_01"]', // Telegraph/Reuters
  'div#ce-comments', // E-Week
  'div#CM-notification-unit', // The New Yorker (paywall notice)
  'div#commentary', // Autonews
  'div#comment_bar', // Autonews
  'div#commentBar', // Newsday
  'div#comment-container', // auburnpub.com
  'div#commentblock', // Learning and Finance
  'div#commentBlock', // NPR
  'div#commenting', // Fox News
  'div#commentLink', // // The Oklahoman
  'div#comment-list', // Bangkok Post
  'div#comment-reply-form', // Sparkfun
  'div#comments', // CBS News
  'div#commentslist', // The Jewish Press
  'div#comment_sign', // Ace Showbiz
  'div#comments-tabs', // Houston News
  'div#comment_toggle', // Charlotte Observer
  'div#commentpolicy', // PBS
  'div#commentPromo', // Salt Lake Tribune
  'div#content-below', // SysCon Media
  'div#ctl00_ContentPlaceHolder1_UC_UserComment1_updatePanelComments', // Ahram
  'div#dailydot-socialbar', // Daily Dot
  'div[data-module-zone="articletools_bottom"]', // The Wall Street Journal
  'div[data-ng-controller="moreLikeThisController"]', // MSNBC
  'div#dfp-ad-mosad_1-wrapper', // The Hill
  'div#digital-editions', // The New Yorker
  'div#disqus', // ABCNews
  'div#disqusAcc', // Telegraph Co Uk
  'div#disqus_comments_section', // Herald Scotland
  'div#disqus_thread', // Renew Economy
  'div#email-sign-up', // BBC
  'div#entry-tags', // hostilefork
  'div#epilogue', // hostilefork
  'div#et-sections-dropdown-list', // The Washington Post
  'div#external-source-links', // Daily Mail UK
  'div#features', // BBC News
  'div#footer', // Newsday
  'div#forgotPassword', // Joplin Globe
  'div#forgotPasswordSuccess', // Joplin Globe
  'div#gkSocialAPI', // The Guardian
  'div#guidelines-wrap', // Charlotte Observer
  'div#hsa_container', // Star Advertiser
  'div#infinite-list', // The Daily Mail
  'div#inlineAdCont', // Salt Lake Tribune
  'div#inset_groups', // Gizmodo
  'div[itemprop="comment"]',// KMBC
  'div#jp-relatedposts', // IT Governance USA
  'div#latest-by-section', // Houston News
  'div#leader', // hostilefork
  'div#livefyre-wrapper', // The Wall Street Journal
  'div.main > div#rail', // Fox News

  'div#main-content > div.share', // Knight News Challenge
  'div#main div#secondary', // Newsday
  'div#mergeAccounts', // Joplin Globe
  'div#metabox', // Global Dispatch
  'div#meta-related', // Entertainment Weekly
  'div#mc_embed_signup', // stgeorgeutah.com
  'div#module-recirculation-speedreads',// The Week Left side
  'div#more-on', // NY Post
  'div#most-popular', // BBC
  'div#mostPopularTab', // Reuters
  'div#most-read-news-wrapper', // The Daily Mail
  'div#mostSharedTab', // Reuters
  'div#most-watched-videos-wrapper', // The Daily Mail
  'div#newsletterList', // E-Week
  'div#newsletter_signup_article', // People Magazine
  'div#next_post', // Ace Showbiz
  'div#nlHeader', // E-Week
  'div#page-nav', // Uptown Magazine
  'div#popular-by-section', // Houston News
  'div#popup', // Times of India
  'div#post_socials', // Archeology.org

  'div#powered_by_livefyre_new', // Entertainment Tonight
  'div#premium-box-locked', // Foreign Affairs
  'div[previewtitle="Related NPR Stories"]', // NPR
  'div#prevnext', // hostilefork
  'div#prev_post', // Ace Showbiz
  'div#print-button', // Teleread
  'div#prologue', // hostilefork
  'div#promo-expanding-region', // The Atlantic
  'div#pw-comments-container', // Star Advertiser
  'div#reader-comments', // The Daily Mail
  'div#registration-notice', // Atlantic City Press
  'div#registrationNewVerification', // Joplin Globe
  'div#relartstory', // Times of India
  'div#related', // The Boston Globe (note: wary of using this)
  'div#related_items', // Business Week
  'div#relatedlinks', // ABC News
  'div#related-services', // BBC
  'div#related-stories', // Daily News
  'div#related-tags', // St. Louis Today
  'div#relatedTopics', // Reuters
  'div#related-videos-container', // E-Online
  'div#respond', // Stanford Law
  'div#returnTraditional', // Joplin Globe
  'div#returnSocial', // Joplin Globe
  'div#reveal-comments', // Aeon Magazine
  'div#right-column', // The Hindu
  'div#rn-section', // Getty
  'div[role="article"] div.DM', // Google Plus comments
  'div[role="article"] div.Qg', // Google Plus comment count
  'div[role="article"] div.QM', // Google Plus entry tags
  'div[role="article"] div.yx', // Google Plus footer
  'div[role="complementary"]', // USA Today
  'div#rt_contact', // CNBC
  'div#rt_featured_franchise', // CNBC
  'div#rt_primary_1', // CNBC
  'div[id^="rt_promo"]', // CNBC
  'div#rt_related_0', // CNBC
  'div#savedata1', // Times of India
  'div#sb_2010_story_tools', // Star Advertiser
  'div#section-comments',  // The Washington Post
  'div#section-kmt', // The Guardian
  'div#share', // Teleread
  'div#sharebarx_new', // Times of India
  'div#share-block-bottom', // Dispatch.com
  'div#share-bottom', // Teleread
  'div#shareComments', // Teleread (also, gigya)
  'div#shareComments-bottom', // Teleread
  'div.share > div.right', // auburnpub.com
  'div#sidebar', // The Appendix
  'div#sidebar-3', // SysCon Media
  'div#sidebar-4', // SysCon Media
  'div#signIn', // Joplin
  'div#simple_socialmedia', // Freakonomics
  'div#social-links', // Reuters
  'div#socialRegistration', // Joplin Globe
  'div#social-share', // Priceonomics
  'div#socialTools', // Salt Lake Tribute
  'div#ssba', // Clizbeats
  'div#sticky-nav', // Christian Science Monitor
  'div#story_add_ugc', // Fort Worth Star Telegram
  'div#storyContinuesBelow', // Salt Lake Tribune
  'div#storyControls', // Politico
  'div#story-embed-column', // Christian Science Monitor
  'div#story-footer', // The Miami Herald
  'div#storyMoreOnFucntion', // Telegraph UK
  'div#story_right_column_ad', // dailyjournal.net
  'div#story-share-buttons', // USA Today
  'div#story-share-buttons-old', // USA Today
  'div#story-shoulder', // AV Web
  'div#subscription-notice', // Atlantic City Press
  'div#tabs-732a40a7-tabPane-2', // The Miami Herald (unclear)
  'div#teaserMarketingCta', // The Times
  'div#teaser-overlay', // The Times
  'div#thumb-scroller', // E-Week
  'div#tmg-related-links', // Telegraph Co
  'div#tncms-region-jh-article-bottom-content', // Idaho Press
  'div#traditionalRegistration', // Joplin Globe
  'div#traditionalAuthenticateMerge', // Joplin Globe
  'div#utility', // WRAL
  'div#video-share', // ABC News
  'div#vuukle_env', // The Hindu
  'div#WNCol4', // Fox (subsidary myfoxny.com)
  'div#WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
  'div#you-might-like', // The New Yorker
  'div#zergnet', // Comic Book Resources
  'dl.blox-social-tools-horizontal', // Joplin

  'dl.keywords', // Vanity Fair
  'dl.related-mod', // Fox News
  'dl.tags', // NY Daily News

  'dl#comments', // CJR
  'figure.ib-figure-ad', // KMBC
  'figure.kudo', // svbtle.com blogs
  'form#comment_form', // Doctors Lounge
  'form.comments-form', // CJR
  'h1#external-links', // The Sprawl (preceds unnamed <ul>)
  'h2#comments', // WordPress lemire-theme
  'h2.hide-for-print', // NobelPrize.org
  'h2#page_header', // CNBC
  'h3#comments-header', // Knight News Challenge
  'h3.more-keywords', // Joplin
  'h3.related_title', // Teleread
  'h3#scrollingArticlesHeader', // The Oklahoman
  'h4.taboolaHeaderRight', // KMBC
  'img#ajax_loading_img', // E-Week
  'li.comments', // Smashing Magazine
  'li#mostPopularShared_0', // Reuters
  'li#mostPopularShared_1', // Reuters
  'li#pagingControlsPS', // neagle
  'li#sharetoolscontainer', // neagle
  'li.tags', // Smashing Magazine
  'ol[data-vr-zone="Around The Web"]', // The Oklahoman
  'ol#comment-list', // Pro Football Talk
  'ol#commentlist', // WordPress lemire-theme
  'p.article-more', // The Boston Globe
  'p.authorFollow', // The Sydney Morning Herald
  'p.byline', // Newsday
  'p.category', // SysCon Media
  'p.comments', // Telegraph Co Uk
  'p.copy-rights-text', // Jerusalem Post
  'p.essay-tags', // Aeon Magazine
  'p.meta', // http://michael.otacoo.com/
  'p.moreVideosTitle', // E-Online
  'p.must-log-in', // The Jewish Press
  'p.pagination', // Stamford Advocate
  'p.p_top_10', // Star Telegram
  'p.post-tags', // USA Today
  'p.section-tag', // NY Post
  'p.sm_icon_subscribe', // The Week
  'p.story-ad-txt', // Boston.com
  'p.storytag', // chinatopix.com
  'p.story-tags', // Latin Post
  'p.topics', // ABC News
  'p.trial-promo', // Newsweek
  'p.subscribe_miles', // Charlotte Observer
  'p#whoisviewing', // Eev blog
  'g\\:plusone',
  'section.also-on', // Huffington Post
  'section.around-bbc-module', // BBC
  'section.article-author', // Ars Technica
  'section.article-contributors', // The New Yorker
  'section.bottom_shares', // BuzzFeed
  'section.breaking_news_bar', // Bloomberg
  'section#comment-module', // Dispatch.com
  'section#comments', // TechSpot
  'section.comments', // ABC Chicago
  'section#comments-area', // The Economist
  'section#follow-us', // BBC
  'section.headband', // Bloomberg
  'section.headline-list', // The Miami Herald
  'section.headlines-list', // ABC Chicago
  'section#injected-newsletter', // GigaOM
  'section.morestories', // Entertainment Tonight
  'section#more_stories', // NBC Nebraska
  'section#more-stories-widget', // The Miami Herald
  'section#newsletter-signup', // New Yorker
  'section.pagination_controls', // Vanity Fair
  'section#promotions', // The New Yorker
  'section.related_links', // Bloomberg
  'section#related-links', // BuzzFeed
  'section.related-products', // TechSpot
  'section#relatedstories', // NPR
  'section#responses', // BuzzFeed
  'section.section--last', // Medium
  'section.section-tertiary', // Sports Illustrated
  'section.share-section', // Sports Illustrated
  'section.signup-widget', // The Miami Herald
  'section.story-tools-mod', // Boston.com
  'section.suggested-links', // The Examiner
  'section.tagblock', // Entertainment Tonight
  'section.three-up', // The Huffington Post
  'section.topnews', // Christian Times
  'section.top-video', // ABC 7 News
  'section.youmaylike', // Entertainment Tonight
  'span.comment-count-generated', // Teleread
  'span.fb-recommend-btn', // The Daily Voice
  'span[itemprop="inLanguage"]', // Investors.com
  'span.sharetools-label', // NY Time
  'span.moreon-tt', // Teleread
  'span.printfriendly-node', // Uncover California
  'span.story-date', // BBC Co Uk
  'span.text_resizer', // Fort Worth Star Telegram
  'table.hst-articleprinter', // Stamford Advocate
  'table#commentTable', // Times of India
  'table.complexListingBox', // Mercury News
  'table.storyauthor', // SysCon Media
  'table.TopNavigation', // LWN
  'ul#additionalShare', // NBC
  'ul.articleList', // The Wall Street Journal
  'ul.article-options', // TVNZ
  'ul.article-related-wrap', // Jerusalem Post
  'ul.article-share', // DNA India
  'ul.article-share-bar', // Herald Scotland
  'ul#article-share-links', // The Boston Herald
  'ul.article-social', // NBC News
  'ul.article-tags', // 9News
  'ul.article_tools', // The Wall Street Journal
  'ul#associated', // TV New Zealand
  'ul#blox-body-nav', // Houston News
  'ul.blox-recent-list', // Atlantic City Press
  'ul.breadcrumb', // The Miami Herald
  'ul.breadcrumbs', // Giga OM
  'ul#bread-crumbs', // Dispatch.com
  'ul.breaking-news-stories', // ABC 7 News
  'ul.bull-list', // Joplin
  'ul.cats', // Windows Central
  'ul.comment-list', // Sparkfun
  'ul#content_footer_menu', // Japan Times
  'ul.display-posts-listing', // Recode
  'ul.entry-extra', // Wired Magazine
  'ul.entry-header', // Wired Magazine
  'ul.entry_sharing', // Bloomberg
  'ul#flairBar', // Scientific American
  'ul.flippy', // MSNBC
  'ul.generic_tabs', // Bloomberg
  'ul.header-lnks', // Knight News Challenge
  'ul.hl-list', // Chron.com
  'ul.links--inline', // Drupal
  'ul.links-list', // BBC
  'ul.m-block__meta__links', // Tomahawk Nation
  'ul.menu', // The New York Times
  'ul.mod-page-actions', // ESPN
  'ul.navbar-nav', // Noctua Software Blog
  'ul.navigation', // USA Today
  'ul.nav-tabs', // The Miami Herald
  'ul.newslist', // Autonews
  'ul#page-actions-bottom', // ESPN
  'ul.pageBoxes', // Investors.com
  'ul.pagenav', // The Guardian
  'ul.pagination', // Politico
  'ul.pagination-story', // Time
  'ul.project-nav', // Kickstarter
  'ul.related-links', // The Boston Globe
  'ul.related_links', // Ottawa Citizen
  'ul.related-posts', // Concurring Opinions
  'ul.resize-nav', // Channel News Asia
  'ul.rssi-icons', // Pacific Standard Magazine
  'ul.services', // The Appendix
  'ul.share', // WBUR
  'ul.sharebar', // CNet
  'ul.share-buttons', // Ars Technica
  'ul.share_top', // CJR
  'ul.sharing-tool', // The Daily Voice
  'ul.side-news-list', // Channel News Asia
  'ul.singleshare', // Freakonomics
  'ul.sns-buttons', // The Daily Voice
  'ul#social', // rickeyre blog
  'ul.social', // The Sydney Morning Herald
  'ul.social-bookmarking-module', // Wired Magazine
  'ul.social-buttons', // Spoon-Tamago
  'ul.socialByline', // The Wall Street Journal (blog)
  'ul.social-icons', // Citylab
  'ul.social-list', // NBC News
  'ul.socials', // independent.ie
  'ul.social-share-list', // TechCrunch
  'ul.social-tools', // The Washington Post
  'ul#story-font-size', // Idaho Press
  'ul#story-social', // AV Web
  'ul#story-tools', // AV Web
  'ul.story-tools-sprite', // Houston News
  'ul.tags', // BBC
  'ul.tags-listing', // Colorado Independent
  'ul.text-scale', // GigaOM
  'ul.thumbs', // NY Daily News
  'ul#toolbar-sharing', // UT San Diego
  'ul.tools', // The Syndey Morning Herald
  'ul#topics', // Yahoo News
  'ul.toplinks', // VOA News
  'ul.top-menu', // Investors.com
  'ul.utility-list' // WRAL
];

const JOINED_BLACKLIST_SELECTORS = BLACKLIST_SELECTORS.join(',');


} // END ANONYMOUS NAMESPACE
