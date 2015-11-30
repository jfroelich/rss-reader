// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Remove blacklisted elements. Define in global scope
function _filterBlacklistedElements(document) {
	removeElementsByName(document);
	removeElementsById(document, 'div', DIV_IDS);
	removeElementsById(document, 'ul', LIST_IDS);
	removeElementsById(document, 'aside', ASIDE_IDS);
	removeElementsById(document, 'section', SECTION_IDS);
	removeElementsByClass(document, 'div', DIV_CLASSES);
	removeElementsByClass(document, 'a', ANCHOR_CLASSES);
	removeElementsByClass(document, 'ul', LIST_CLASSES);
	removeElementsByClass(document, 'aside', ASIDE_CLASSES);
	removeElementsByClass(document, 'p', P_CLASSES);
	removeElementsByClass(document, 'section', SECTION_CLASSES);
	removeElementsByClass(document, 'span', SPAN_CLASSES);
	removeElementsByClass(document, 'table', TABLE_CLASSES);

	// Isolated for perf testing
	removeRest(document);
}

// Export global
this.filterBlacklistedElements = _filterBlacklistedElements;

// NOTE: this appears to be the slowest part of the transform
// It is specifically the call to matches
function removeRest(document) {
	const iterator = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_ELEMENT);
	let element = iterator.nextNode();
	while(element) {
		if(element.matches(JOINED_BLACKLIST_SELECTORS)) {
			element.remove();
		}
		element = iterator.nextNode();
	}
}

// Note: using a nodeiterator yields much better performance
// than a nodelist here (perf tested). Also, using an express
// in loop condition appears to yield better performance than
// passing a filter function to createNodeIterator.
function removeElementsByName(document) {
	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_ELEMENT);
	let element = it.nextNode();
	while(element) {
		if(ELEMENT_NAMES.has(element.localName)) {
			element.remove();
		}
		element = it.nextNode();
	}
}

// note: assumes no dup ids
function removeElementsById(document, tagName, ids) {
	const numIds = ids.length;
	let element = null;
	for(let i = 0; i < numIds; i++) {
		element = document.getElementById(ids[i]);
		if(element && element.localName === tagName) {
			element.remove();
		}
	}
}

// todo: experiment with element.classList.contains
function removeElementsByClass(document, tagName, classSet) {
	const elements = document.getElementsByTagName(tagName);
	const numElements = elements.length;
	for(let i = numElements - 1; i > -1; i--) {
		const element = elements[i];
		const className = element.className || '';
		const classList = className.split(' ');
		const numClasses = classList.length;
		for(let j = 0; j < numClasses; j++) {
			const classValue = classList[j];
			if(classValue && classSet.has(classValue)) {
				element.remove();
				break;
			}
		}
	}
}

// Elements that are explicitly blacklisted
const ELEMENT_NAMES = new Set([
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

const ANCHOR_CLASSES = new Set([
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
]);

// NOTE: cannot use 'div.share'
// NOTE: cannot use 'div.posts' (wordpress copyblogger theme)
// NOTE: cannot use 'div.menu' // CNBC
// NOTE: cannot use 'div.pull-right' (oklahoman vs nccgroup blog)

const DIV_CLASSES = new Set([
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
	'trb_panelmod_body', //	LA Times
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
]);

const DIV_IDS = [
	'a-all-related', // New York Daily News
	'addshare', // The Hindu
	'article_comments', // Fort Worth Star Telegram
	'articleIconLinksContainer', // The Daily Mail
	'articleKeywords', // The Hindu
	'articlepagerreport', // Chron.com
	'authorarea', // Global Dispatch
	'author-byline', // NY Post
	'blq-foot', // BBC
	'block-disqus-disqus_comments', // Foreign Affairs
	'block-fa-cfrlatest', // Foreign Affairs
	'block-fa-related', // Foreign Affairs
	'blog-sidebar', // Comic Book Resources
	'blox-breadcrumbs', // Joplin
	'blox-comments', // National Standard
	'blox-footer', // Joplin
	'blox-header', // Joplin
	'blox-right-col', // Joplin
	'blox-breadcrumbs', // Joplin
	'bottom-rail', // Vanity Fair
	'breadcrumb', // Autonews
	'breadcrumbs', // E-Week
	'ce-comments', // E-Week
	'CM-notification-unit', // The New Yorker (paywall notice)
	'commentary', // Autonews
	'comment_bar', // Autonews
	'commentBar', // Newsday
	'comment-container', // auburnpub.com
	'commentblock', // Learning and Finance
	'commentBlock', // NPR
	'commenting', // Fox News
	'commentLink', // // The Oklahoman
	'comment-list', // Bangkok Post
	'comment-reply-form', // Sparkfun
	'comments', // CBS News
	'commentslist', // The Jewish Press
	'comment_sign', // Ace Showbiz
	'comments-tabs', // Houston News
	'comment_toggle', // Charlotte Observer
	'commentpolicy', // PBS
	'commentPromo', // Salt Lake Tribune
	'content-below', // SysCon Media
	'ctl00_ContentPlaceHolder1_UC_UserComment1_updatePanelComments', // Ahram
	'dailydot-socialbar', // Daily Dot
	'dfp-ad-mosad_1-wrapper', // The Hill
	'digital-editions', // The New Yorker
	'disqus', // ABCNews
	'disqusAcc', // Telegraph Co Uk
	'disqus_comments_section', // Herald Scotland
	'disqus_thread', // Renew Economy
	'email-sign-up', // BBC
	'entry-tags', // hostilefork
	'epilogue', // hostilefork
	'et-sections-dropdown-list', // The Washington Post
	'external-source-links', // Daily Mail UK
	'features', // BBC News
	'footer', // Newsday
	'forgotPassword', // Joplin Globe
	'forgotPasswordSuccess', // Joplin Globe
	'gkSocialAPI', // The Guardian
	'guidelines-wrap', // Charlotte Observer
	'hsa_container', // Star Advertiser
	'infinite-list', // The Daily Mail
	'inlineAdCont', // Salt Lake Tribune
	'inset_groups', // Gizmodo
	'jp-relatedposts', // IT Governance USA
	'latest-by-section', // Houston News
	'leader', // hostilefork
	'livefyre-wrapper', // The Wall Street Journal
	'mergeAccounts', // Joplin Globe
	'metabox', // Global Dispatch
	'meta-related', // Entertainment Weekly
	'mc_embed_signup', // stgeorgeutah.com
	'module-recirculation-speedreads',// The Week Left side
	'more-on', // NY Post
	'most-popular', // BBC
	'mostPopularTab', // Reuters
	'most-read-news-wrapper', // The Daily Mail
	'mostSharedTab', // Reuters
	'most-watched-videos-wrapper', // The Daily Mail
	'newsletterList', // E-Week
	'newsletter_signup_article', // People Magazine
	'next_post', // Ace Showbiz
	'nlHeader', // E-Week
	'page-nav', // Uptown Magazine
	'popular-by-section', // Houston News
	'popup', // Times of India
	'post_socials', // Archeology.org
	'powered_by_livefyre_new', // Entertainment Tonight
	'premium-box-locked', // Foreign Affairs
	'prevnext', // hostilefork
	'prev_post', // Ace Showbiz
	'print-button', // Teleread
	'prologue', // hostilefork
	'promo-expanding-region', // The Atlantic
	'pw-comments-container', // Star Advertiser
	'reader-comments', // The Daily Mail
	'registration-notice', // Atlantic City Press
	'registrationNewVerification', // Joplin Globe
	'relartstory', // Times of India
	'related', // The Boston Globe (note: wary of using this)
	'related_items', // Business Week
	'relatedlinks', // ABC News
	'related-services', // BBC
	'related-stories', // Daily News
	'related-tags', // St. Louis Today
	'relatedTopics', // Reuters
	'related-videos-container', // E-Online
	'respond', // Stanford Law
	'returnTraditional', // Joplin Globe
	'returnSocial', // Joplin Globe
	'reveal-comments', // Aeon Magazine
	'right-column', // The Hindu
	'rn-section', // Getty
	'rt_contact', // CNBC
	'rt_featured_franchise', // CNBC
	'rt_primary_1', // CNBC
	'rt_related_0', // CNBC
	'savedata1', // Times of India
	'sb_2010_story_tools', // Star Advertiser
	'section-comments',	// The Washington Post
	'section-kmt', // The Guardian
	'share', // Teleread
	'sharebarx_new', // Times of India
	'share-block-bottom', // Dispatch.com
	'share-bottom', // Teleread
	'shareComments', // Teleread (also, gigya)
	'shareComments-bottom', // Teleread
	'sidebar', // The Appendix
	'sidebar-3', // SysCon Media
	'sidebar-4', // SysCon Media
	'signIn', // Joplin
	'simple_socialmedia', // Freakonomics
	'social-links', // Reuters
	'socialRegistration', // Joplin Globe
	'social-share', // Priceonomics
	'socialTools', // Salt Lake Tribute
	'ssba', // Clizbeats
	'sticky-nav', // Christian Science Monitor
	'story_add_ugc', // Fort Worth Star Telegram
	'storyContinuesBelow', // Salt Lake Tribune
	'storyControls', // Politico
	'story-embed-column', // Christian Science Monitor
	'story-footer', // The Miami Herald
	'storyMoreOnFucntion', // Telegraph UK
	'story_right_column_ad', // dailyjournal.net
	'story-share-buttons', // USA Today
	'story-share-buttons-old', // USA Today
	'story-shoulder', // AV Web
	'subscription-notice', // Atlantic City Press
	'tabs-732a40a7-tabPane-2', // The Miami Herald (unclear)
	'teaserMarketingCta', // The Times
	'teaser-overlay', // The Times
	'thumb-scroller', // E-Week
	'tmg-related-links', // Telegraph Co
	'tncms-region-jh-article-bottom-content', // Idaho Press
	'traditionalRegistration', // Joplin Globe
	'traditionalAuthenticateMerge', // Joplin Globe
	'utility', // WRAL
	'video-share', // ABC News
	'vuukle_env', // The Hindu
	'WNCol4', // Fox (subsidary myfoxny.com)
	'WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
	'you-might-like', // The New Yorker
	'zergnet' // Comic Book Resources
];

const LIST_IDS = [
	'additionalShare', // NBC
	'article-share-links', // The Boston Herald
	'associated', // TV New Zealand
	'blox-body-nav', // Houston News
	'bread-crumbs', // Dispatch.com
	'content_footer_menu', // Japan Times
	'flairBar', // Scientific American
	'page-actions-bottom', // ESPN
	'social', // rickeyre blog
	'story-font-size', // Idaho Press
	'story-social', // AV Web
	'story-tools', // AV Web
	'toolbar-sharing', // UT San Diego
	'topics' // Yahoo News
];


const LIST_CLASSES = new Set([
	'articleList', // The Wall Street Journal
	'article-options', // TVNZ
	'article-related-wrap', // Jerusalem Post
	'article-share', // DNA India
	'article-share-bar', // Herald Scotland
	'article-social', // NBC News
	'article-tags', // 9News
	'article_tools', // The Wall Street Journal
	'blox-recent-list', // Atlantic City Press
	'breadcrumb', // The Miami Herald
	'breadcrumbs', // Giga OM
	'breaking-news-stories', // ABC 7 News
	'bull-list', // Joplin
	'cats', // Windows Central
	'comment-list', // Sparkfun
	'display-posts-listing', // Recode
	'entry-extra', // Wired Magazine
	'entry-header', // Wired Magazine
	'entry_sharing', // Bloomberg
	'flippy', // MSNBC
	'generic_tabs', // Bloomberg
	'header-lnks', // Knight News Challenge
	'hl-list', // Chron.com
	'links--inline', // Drupal
	'links-list', // BBC
	'm-block__meta__links', // Tomahawk Nation
	'menu', // The New York Times
	'mod-page-actions', // ESPN
	'navbar-nav', // Noctua Software Blog
	'navigation', // USA Today
	'nav-tabs', // The Miami Herald
	'newslist', // Autonews
	'pageBoxes', // Investors.com
	'pagenav', // The Guardian
	'pagination', // Politico
	'pagination-story', // Time
	'project-nav', // Kickstarter
	'related-links', // The Boston Globe
	'related_links', // Ottawa Citizen
	'related-posts', // Concurring Opinions
	'resize-nav', // Channel News Asia
	'rssi-icons', // Pacific Standard Magazine
	'services', // The Appendix
	'share', // WBUR
	'sharebar', // CNet
	'share-buttons', // Ars Technica
	'share_top', // CJR
	'sharing-tool', // The Daily Voice
	'side-news-list', // Channel News Asia
	'singleshare', // Freakonomics
	'sns-buttons', // The Daily Voice
	'social', // The Sydney Morning Herald
	'social-bookmarking-module', // Wired Magazine
	'social-buttons', // Spoon-Tamago
	'socialByline', // The Wall Street Journal (blog)
	'social-icons', // Citylab
	'social-list', // NBC News
	'socials', // independent.ie
	'social-share-list', // TechCrunch
	'social-tools', // The Washington Post
	'story-tools-sprite', // Houston News
	'tags', // BBC
	'tags-listing', // Colorado Independent
	'text-scale', // GigaOM
	'thumbs', // NY Daily News
	'tools', // The Syndey Morning Herald
	'toplinks', // VOA News
	'top-menu', // Investors.com
	'utility-list' // WRAL
]);

const ASIDE_IDS = [
	'asset-related', // St. Louis Today
	'bpage_ad_bottom', // BuzzFeed
	'fbookulous-flyer', // ProPublica
	'post_launch_success', // BuzzFeed
	'related-content-xs', // The Miami Herald
	'secondary-rail', // Dispatch.com
	'sidebar', // TechSpot
	'sidebar-read-more', // USA Today
	'story-related-topics' // AV Web
];

const ASIDE_CLASSES = new Set([
	'author-blocks', // ProPublica
	'itemAsideInfo', // The Guardian
	'bg-related', // The Boston Globe
	'callout', // The Atlantic
	'entry-sidebar', // The Globe
	'global-magazine-recent', // Politico
	'global-popular', // Politico
	'inset-section',// Techcrunch
	'karma', // Swissinfo.ch
	'like-this', // ProPublica
	'livefyre-comments', // Vanity Fair
	'meta_extras', // Japan Times
	'marginalia', // NY Times
	'mashsb-container', // cryptocoinsnews.com
	'module-2013-follow', // ProPublica
	'module-tabbed-2011', // ProPublica
	'prev-next', // The Economist
	'referenced-wide', // Gawker
	'related-articles', // BBC
	'related-content', // // The Oklahoman
	'related-side', // NY Magazine
	'right-rail-module', // Time
	'see-also', // The Root
	'slickshare', // ProPublica
	'social-stack', // ProPublica
	'story-right-rail', // USA Today
	'story-supplement', // Politico
	'tools', // The Boston Globe
	'vestpocket', // Forbes
	'views-tags', // BuzzFeed
	'widget-area' // thedomains.com
]);

const P_CLASSES = new Set([
	'article-more', // The Boston Globe
	'authorFollow', // The Sydney Morning Herald
	'byline', // Newsday
	'category', // SysCon Media
	'comments', // Telegraph Co Uk
	'copy-rights-text', // Jerusalem Post
	'essay-tags', // Aeon Magazine
	'meta', // http://michael.otacoo.com/
	'moreVideosTitle', // E-Online
	'must-log-in', // The Jewish Press
	'pagination', // Stamford Advocate
	'p_top_10', // Star Telegram
	'post-tags', // USA Today
	'section-tag', // NY Post
	'sm_icon_subscribe', // The Week
	'story-ad-txt', // Boston.com
	'storytag', // chinatopix.com
	'story-tags', // Latin Post
	'topics', // ABC News
	'trial-promo', // Newsweek
	'subscribe_miles' // Charlotte Observer
]);

const SECTION_IDS = [
	'comments', // TechSpot, concurringopinions
	'comment-module', // Dispatch.com
	'comments-area', // The Economist
	'follow-us', // BBC
	'injected-newsletter', // GigaOM
	'more_stories', // NBC Nebraska
	'more-stories-widget', // The Miami Herald
	'newsletter-signup', // New Yorker
	'promotions', // The New Yorker
	'related-links', // BuzzFeed
	'relatedstories', // NPR
	'responses' // BuzzFeed
];

const SECTION_CLASSES = new Set([
	'also-on', // Huffington Post
	'around-bbc-module', // BBC
	'article-author', // Ars Technica
	'article-contributors', // The New Yorker
	'bottom_shares', // BuzzFeed
	'breaking_news_bar', // Bloomberg
	'comments', // ABC Chicago
	'headband', // Bloomberg
	'headline-list', // The Miami Herald
	'headlines-list', // ABC Chicago
	'morestories', // Entertainment Tonight
	'pagination_controls', // Vanity Fair
	'related_links', // Bloomberg
	'related-products', // TechSpot
	'section--last', // Medium
	'section-tertiary', // Sports Illustrated
	'share-section', // Sports Illustrated
	'signup-widget', // The Miami Herald
	'story-tools-mod', // Boston.com
	'suggested-links', // The Examiner
	'tagblock', // Entertainment Tonight
	'three-up', // The Huffington Post
	'topnews', // Christian Times
	'top-video', // ABC 7 News
	'youmaylike' // Entertainment Tonight
]);

const SPAN_CLASSES = new Set([
	'span.comment-count-generated', // Teleread
	'span.fb-recommend-btn', // The Daily Voice
	'sharetools-label', // NY Time
	'moreon-tt', // Teleread
	'printfriendly-node', // Uncover California
	'story-date', // BBC Co Uk
	'text_resizer' // Fort Worth Star Telegram
]);

const TABLE_CLASSES = new Set([
	'hst-articleprinter', // Stamford Advocate
	'complexListingBox', // Mercury News
	'storyauthor', // SysCon Media
	'TopNavigation' // LWN
]);

// NOTE: cannot use 'article div.share' (Vanity Fair vs Concurring Opinions)
const BLACKLIST_SELECTORS = [
	'a[href^="http://ad.doubleclick"]', // Medium
	'a[href*="socialtwist"]', // The Jewish Press
	'a[rel="tag"]', // // The Oklahoman
	'article div.extra', // Washington Post
	'article > div.tags', // NPR
	'article ul.listing', // Good Magazine
	'aside[data-panelmod-type="relatedContent"]', // LA Times
	'b.toggle-caption', // NPR
	'fb\\:comments',
	'div[aria-label="+1 this post"]', // Google Plus
	'div.artbody > div.share', // China Topix
	'div.article div.columnsplitter', // CTV News
	'div#article div.share', // timeslive.co.za
	'div.article div.short-url', // Politico
	'div.article div.tags', // Politico
	'div.article div#media', // Newsday
	'div[data-vr-zone="You May Like"]', // Voice of America
	'div.article-text div.fullArticle', // Intl Business Times UK
	'div[data-ng-controller="bestOfMSNBCController"]', // MSNBC
	'div[bucket-id="most_popular_01"]', // Telegraph/Reuters
	'div[bucket-id="secondary_navigation_01"]', // Telegraph/Reuters
	'div[data-module-zone="articletools_bottom"]', // The Wall Street Journal
	'div[data-ng-controller="moreLikeThisController"]', // MSNBC
	'div[itemprop="comment"]',// KMBC
	'div.main > div#rail', // Fox News
	'div#main-content > div.share', // Knight News Challenge
	'div#main div#secondary', // Newsday
	'div[previewtitle="Related NPR Stories"]', // NPR
	'div[role="article"] div.DM', // Google Plus comments
	'div[role="article"] div.Qg', // Google Plus comment count
	'div[role="article"] div.QM', // Google Plus entry tags
	'div[role="article"] div.yx', // Google Plus footer
	'div[role="complementary"]', // USA Today
	'div[id^="rt_promo"]', // CNBC
	'div.share > div.right', // auburnpub.com
	'dl.blox-social-tools-horizontal', // Joplin
	'dl.keywords', // Vanity Fair
	'dl.related-mod', // Fox News
	'dl.tags', // NY Daily News
	'dl#comments', // CJR
	'figure.ib-figure-ad', // KMBC
	'figure.kudo', // svbtle.com blogs
	'figure#opinion-newsletter-promo', // nytimes.com
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
	'p#whoisviewing', // Eev blog
	'g\\:plusone',
	'span[itemprop="inLanguage"]', // Investors.com
	'table#commentTable' // Times of India
];

const JOINED_BLACKLIST_SELECTORS = BLACKLIST_SELECTORS.join(',');

} // END ANONYMOUS NAMESPACE
