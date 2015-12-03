// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Creates a boilerplate filtering function
function createCalamineClassifier(annotate, document) {

	// TODO: use for..of destructuring when supported

	if(!document.querySelector('body')) {
		return isAlwaysContentElement;
	}

	let bodyElement = fastFindBodyElement(document);
	let flagged = null;
	if(bodyElement) {
		flagged = classifyBoilerplate(bodyElement);
		return isContentElement.bind(this, bodyElement, flagged);
	}

	// Prefill scores map used by various feature extractors
	// TODO: deprecate once i switched over to returning maps below
	const scores = new Map();
	// TODO: use for..of once NodeList is iterable
	Array.prototype.forEach.call(document.getElementsByTagName('*'),
		function setInitialElementScore(element) {
		scores.set(element, 0.0);
	});

	const textScores = analyzeText(document);
	const typeScores = analyzeTypes(document, scores, annotate);
	const topologyScores = analyzeTopology(document, scores, annotate);
	analyzeImages(document, scores, annotate);
	analyzeAttributes(document, scores, annotate);
	analyzeMicrodata(document, scores, annotate);

	// Integrate the scores
	for(let entry of textScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	for(let entry of typeScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	for(let entry of topologyScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	if(annotate) {
		for(let entry of textScores) {
			entry[0].dataset.textBias = entry[1].toFixed(2);
		}

		for(let entry of typeScores) {
			entry[0].dataset.intrinsicBias = entry[1];
		}

		for(let entry of topologyScores) {
			entry[0].dataset.topologyScore = entry[1];
		}

		for(let entry of scores) {
			entry[0].dataset.score = entry[1].toFixed(2);
		}
	}

	// Set bodyElement to element with highest score, defaulting
	// to document.body.
	bodyElement = document.body;
	let bestScore = scores.get(bodyElement);
	for(let entry of scores) {
		if(entry[1] > bestScore) {
			bodyElement = entry[0];
			bestScore = entry[1];
		}
	}

	flagged = classifyBoilerplate(bodyElement);
	return isContentElement.bind(this, bodyElement, flagged);
}

// Export global
this.createCalamineClassifier = createCalamineClassifier;

const BODY_SIGNATURES = [
  'article',
  '.hentry',
  '.entry-content',
  '#article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
	'.repository-content',
  '[itemprop="articleBody"]',
  '[role="article"]',
  '[itemtype="http://schema.org/Article"]',
  '[itemtype="http://schema.org/NewsArticle"]',
  '[itemtype="http://schema.org/BlogPosting"]',
  '[itemtype="http://schema.org/Blog"]',
  '[itemtype="http://schema.org/WebPage"]',
  '[itemtype="http://schema.org/TechArticle"]',
  '[itemtype="http://schema.org/ScholarlyArticle"]',
  '#WNStoryBody'
];

const NUM_SIGNATURES = BODY_SIGNATURES.length;

// Looks for obvious best elements based on known content signatures
function fastFindBodyElement(document) {
	let elements = null;
	for(let i = 0; i < NUM_SIGNATURES; i++) {
		elements = document.body.querySelectorAll(BODY_SIGNATURES[i]);
		if(elements.length === 1) {
			return elements[0];
		}
	}
}

// A dummy classifier that treats every element as content
function isAlwaysContentElement(element) {
	return true;
}

// The function returned by createCalamineClassifier
// TODO: look into using Node.compareDocumentPosition instead of contains
function isContentElement(bodyElement, flagged, element) {
	return element === bodyElement ||
		element.contains(bodyElement) ||
		(bodyElement.contains(element) &&
			!flagged.has(element));
}

function isArticleElement(element) {
	return element.localName === 'article';
}

// Returns a set containing all elements within the root element
// classified as boilerplate. Note that an element is also considered
// boilerplate if it is a descendant of a boilerplate element.
// TODO: is this a proper place to use a WeakSet?
// TODO: consider in-document title as boilerplate if external title is known
function classifyBoilerplate(rootElement) {
	const flagged = new WeakSet();
	const elements = rootElement.getElementsByTagName('*');
	let subElements = null;
	let numSubs = 0;
	let j = 0;

	for(let i = 0, len = elements.length, element; i < len; i++) {
		element = elements[i];

		// If it is a sub element added from a previous iteration, skip
		if(flagged.has(element)) {
			continue;
		}

		if(isBoilerplateElement(element)) {
			flagged.add(element);

			// Flag all sub elements so we can later skip them in the outer loop
			subElements = element.getElementsByTagName('*');
			for(j = 0, numSubs = subElements.length; j < numSubs; j++) {
				flagged.add(subElements[j]);
			}
		}
	}
	return flagged;
}

// TODO: eventually improve the logic here, it is pretty ugly. Maybe we
// need to do some type of earlier feature extraction, and then just
// query against that. If we have extractors return a separate map instead
// of updating the common net score map, we could just pass in the one
// appropriate map here and check against it.
// TODO: use for..of {Set} once Chrome stops deopting
// TODO: use const/let once Chrome stops deopting
function isBoilerplateElement(element) {
	var localName = element.localName;

	if(localName === 'div') {
		if(element.id && DIV_IDS.has(element.id)) {
			return true;
		}

		var classList = element.classList;
		for(var i = 0, len = DIV_CLASSES.length; i < len; i++) {
			if(classList.contains(DIV_CLASSES[i])) {
				return true;
			}
		}

		// 'article div.extra' Washington Post
		if(classList.contains('extra')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(isArticleElement)) {

				return true;
			}
		}

		// 'article > div.tags' NPR
		// 'div.article div.tags' Politico
		if(classList.contains('tags')) {
			var parent = element.parentElement;
			if(parent && parent.localName === 'article') {
				return true;
			}

			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div.article');
				})) {
				return true;
			}
		}

		// 'div#main-content > div.share' Knight News Challenge
		// 'div.artbody > div.share' China Topix
		// 'div#article div.share' timeslive.co.za
		// NOTE: cannot use 'article div.share'
		// (Vanity Fair vs Concurring Opinions)
		if(classList.contains('share')) {
			var parent = element.parentElement;
			if(parent && parent.matches('div.artbody, div#main-content')) {
				return true;
			}

			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div#article');
				})) {
				return true;
			}
		}

		// 'div.article div.columnsplitter' CTV News
		if(classList.contains('columnsplitter')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div.article');
				})) {
				return true;
			}
		}

		// 'div.article div.short-url' Politico
		if(classList.contains('short-url')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div.article');
				})) {
				return true;
			}
		}

		// 'div.article div#media' Newsday
		if(element.id === 'media') {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div.article');
				})) {
				return true;
			}
		}

		// 'div.article-text div.fullArticle' Intl Business Times UK
		if(classList.contains('fullArticle')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div.article-text');
				})) {
				return true;
			}
		}

		// 'div.share > div.right' auburnpub.com
		if(classList.contains('right')) {
			var parent = element.parentElement;
			if(parent && parent.matches('div.share')) {
				return true;
			}
		}

		// 'div.main > div#rail' Fox News
		if(element.id === 'rail') {
			var parent = element.parentElement;
			if(parent && parent.matches('div.main')) {
				return true;
			}
		}

		// 'div#main div#secondary' Newsday
		if(element.id === 'secondary') {
			var parent = element.parentElement;
			if(parent && parent.matches('div#main')) {
				return true;
			}
		}

		// 'div[role="article"] div.DM' Google Plus comments
		// 'div[role="article"] div.Qg' Google Plus comment count
		// 'div[role="article"] div.QM' Google Plus entry tags
		// 'div[role="article"] div.yx' Google Plus footer
		if(classList.contains('DM') || classList.contains('Qg') ||
			classList.contains('QM') || classList.contains('yx')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(function(element) {
				return element.matches('div[role="article"]');
				})) {
				return true;
			}
		}

		// 'div[aria-label="+1 this post"]' Google Plus
		var ariaLabel = element.getAttribute('aria-label');
		if(ariaLabel === '+1 this post') {
			return true;
		}

		// 'div[data-vr-zone="You May Like"]' Voice of America
		// 'div[data-ng-controller="bestOfMSNBCController"]' MSNBC
		// 'div[data-ng-controller="moreLikeThisController"]' MSNBC
		// 'div[data-module-zone="articletools_bottom"]' The Wall Street Journal
		if(element.dataset) {
			if(element.dataset.vrZone === 'You May Like')
				return true;
			if(element.dataset.ngController === 'bestOfMSNBCController')
				return true;
			if(element.dataset.ngController === 'moreLikeThisController')
				return true;
			if(element.dataset.moduleZone === 'articletools_bottom')
				return true;
		}

		// 'div[bucket-id="most_popular_01"]' Telegraph/Reuters
		// 'div[bucket-id="secondary_navigation_01"]' Telegraph/Reuters
		var bucketId = element.getAttribute('bucket-id');
		if(bucketId === 'most_popular_01' ||
			bucketId === 'secondary_navigation_01') {
			return true;
		}

		// 'div[id^="rt_promo"]'  CNBC
		if(element.id && element.id.startsWith('rt_promo'))
			return true;

		// 'div[itemprop="comment"]' KMBC
		if(element.getAttribute('itemprop') === 'comment')
			return true;
		// 'div[previewtitle="Related NPR Stories"]' NPR
		if(element.getAttribute('previewtitle') === 'Related NPR Stories')
			return true;
		// 'div[role="complementary"]' USA Today
		if(element.getAttribute('role') === 'complementary')
			return true;

	} else if(localName === 'ul') {
		if(LIST_IDS.has(element.id)) {
			return true;
		}
		var classList = element.classList;
		for(var i = 0, len = LIST_CLASSES.length; i < len; i++) {
			if(classList.contains(LIST_CLASSES[i])) {
				return true;
			}
		}

		// 'article ul.listing' Good Magazine
		if(classList.contains('listing')) {
			var ancestors = DOMUtils.getAncestors(element);
			if(ancestors.find(isArticleElement)) {
				return true;
			}
		}

	} else if(localName === 'a') {
		var classList = element.classList;
		for(var i = 0, len = ANCHOR_CLASSES.length; i < len; i++) {
			if(classList.contains(ANCHOR_CLASSES[i])) {
				return true;
			}
		}

		// Special anchor cases
		var href = element.getAttribute('href');
		if(href) {
			if(href.startsWith('http://ad.')) {
				return true;// medium.com
			} else if(href.includes('socialtwist')) {
				return true;// The Jewish Press
			}
		}

		var rel = element.getAttribute('rel');
		if(rel === 'tag') {
			// The Oklahoman
			return true;
		}

	} else if(localName === 'p') {
		var classList = element.classList;
		for(var i = 0, len = P_CLASSES.length; i < len; i++) {
			if(classList.contains(P_CLASSES[i])) {
				return true;
			}
		}

		// 'p#whoisviewing' Eev blog
		if(element.id === 'whoisviewing') {
			return true;
		}

	} else if(localName === 'aside') {
		if(ASIDE_IDS.has(element.id)) {
			return true;
		}

		var classList = element.classList;
		for(var i = 0, len = ASIDE_CLASSES.length; i < len; i++) {
			if(classList.contains(ASIDE_CLASSES[i])) {
				return true;
			}
		}

		// 'aside[data-panelmod-type="relatedContent"]' LA Times
		if(element.getAttribute('data-panelmod-type') === 'relatedContent') {
			return true;
		}

	} else if(localName === 'section') {
		if(SECTION_IDS.has(element.id)) {
			return true;
		}

		var classList = element.classList;
		for(var i = 0, len = SECTION_CLASSES.length; i < len; i++) {
			if(classList.contains(SECTION_CLASSES[i])) {
				return true;
			}
		}
	} else if(localName === 'span') {
		var classList = element.classList;
		for(var i = 0, len = SPAN_CLASSES.length; i < len; i++) {
			if(classList.contains(SPAN_CLASSES[i])) {
				return true;
			}
		}

		// 'span[itemprop="inLanguage"]' Investors.com
		if(element.getAttribute('itemprop') === 'inLanguage') {
			return true;
		}

	} else if(localName === 'table') {
		var classList = element.classList;
		for(var i = 0, len = TABLE_CLASSES.length; i < len; i++) {
			if(classList.contains(TABLE_CLASSES[i])) {
				return true;
			}
		}

		//'table#commentTable' // Times of India
		if(element.id === 'commentTable') {
			return true;
		}

	} else if(localName === 'header') {
		return true;
	} else if(localName === 'footer') {
		return true;
	} else if(localName === 'nav') {
		return true;
	} else if(localName === 'menu') {
		return true;
	} else if(localName === 'menuitem') {
		return true;
	} else if(localName === 'hr') {
		return true;
	} else if(localName === 'b') {
		// 'b.toggle-caption' NPR
		var classList = element.classList;
		if(classList.contains('toggle-caption')) {
			return true;
		}
	} else if(localName === 'li') {
		// 'li#mostPopularShared_0' Reuters
		// 'li#mostPopularShared_1' Reuters
		// 'li#pagingControlsPS' neagle
		// 'li#sharetoolscontainer' neagle
		let id = element.id;
		if(id === 'mostPopularShared_0' || id === 'mostPopularShared_1' ||
			id === 'pagingControlsPS' || id === 'sharetoolscontainer') {
			return true;
		}

		// 'li.comments' Smashing Magazine
		// 'li.tags' Smashing Magazine
		var classList = element.classList;
		if(classList.contains('comments') || classList.contains('tags')) {
			return true;
		}
	} else if(localName === 'dl') {
		//'dl#comments' CJR
		if(element.id === 'comments')
			return true;
		var classList = element.classList;
		//'dl.blox-social-tools-horizontal' Joplin
		if(classList.contains('blox-social-tools-horizontal'))
			return true;
		//'dl.keywords' Vanity Fair
		if(classList.contains('keywords'))
			return true;
		//'dl.related-mod' Fox News
		if(classList.contains('related-mod'))
			return true;
		//'dl.tags' NY Daily News
		if(classList.contains('tags'))
			return true;
	} else if(localName === 'figure') {
		//'figure#opinion-newsletter-promo' nytimes.com
		if(element.id === 'opinion-newsletter-promo')
			return true;
		var classList = element.classList;
		//'figure.ib-figure-ad' KMBC
		if(classList.contains('ib-figure-ad'))
			return true;
		//'figure.kudo' svbtle.com blogs
		if(classList.contains('kudo'))
			return true;
	} else if(localName === 'form') {
		//'form#comment_form' Doctors Lounge
		if(element.id === 'comment_form') {
			return true;
		}
		// 'form.comments-form' CJR
		if(element.classList.contains('comments-form')) {
			return true;
		}
	} else if(localName === 'h1') {
		//'h1#external-links', // The Sprawl (preceds unnamed <ul>)

		if(element.id === 'external-links') {
			return true;
		}
	} else if(localName === 'h2') {
		// 'h2#comments', // WordPress lemire-theme
		// 'h2#page_header', // CNBC
		if(element.id === 'comments' || element.id === 'page_header') {
			return true;
		}
		//'h2.hide-for-print', // NobelPrize.org
		if(element.classList.contains('hide-for-print')) {
			return true;
		}
	} else if(localName === 'h3') {
		//'h3#comments-header', // Knight News Challenge
		//'h3.more-keywords', // Joplin
		//'h3.related_title', // Teleread
		//'h3#scrollingArticlesHeader', // The Oklahoman
		if(element.id === 'comments-header' ||
			element.id === 'scrollingArticlesHeader') {
			return true;
		}

		var classList = element.classList;
		if(classList.contains('more-keywords') ||
			classList.contains('related_title')) {
			return true;
		}
	} else if(localName === 'h4') {
		//'h4.taboolaHeaderRight', // KMBC
		if(element.classList.contains('taboolaHeaderRight')) {
			return true;
		}
	} else if(localName === 'img') {
		// 'img#ajax_loading_img', // E-Week
		if(element.id === 'ajax_loading_img') {
			return true;
		}

		// github
		if(element.getAttribute('alt') === 'Build Status') {
			return true;
		}

	} else if(localName === 'ol') {
		//'ol#comment-list', // Pro Football Talk
		//'ol#commentlist', // WordPress lemire-theme
		//'ol[data-vr-zone="Around The Web"]', // The Oklahoman
		if(element.id === 'comment-list' || element.id === 'commentlist') {
			return true;
		}

		if(element.dataset && element.dataset.vrZone === 'Around The Web') {
			return true;
		}

	} else if(localName === 'fb:comments') {
		return true;
	} else if(localName === 'g:plusone') {
		return true;
	}

	return false;
}

const DIV_IDS = new Set([
	'a-all-related', // New York Daily News
	'addshare', // The Hindu
	'article_comments', // Fort Worth Star Telegram
	'articleIconLinksContainer', // The Daily Mail
	'articleKeywords', // The Hindu
	'articlepagerreport', // Chron.com
	'article_share_print', // lareviewofbooks.org
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
	'header', // theweek.com
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
	'recommended_section', // lareviewofbooks.org
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
	'sliding-menu', // theweek.com
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
	'wiki-rightbar', // Github
	'wiki-footer', // Github
	'WNCol4', // Fox (subsidary myfoxny.com)
	'WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
	'you-might-like', // The New Yorker
	'zergnet' // Comic Book Resources
]);

// NOTE: cannot use 'div.share'
// NOTE: cannot use 'div.posts' (wordpress copyblogger theme)
// NOTE: cannot use 'div.menu' // CNBC
// NOTE: cannot use 'div.pull-right' (oklahoman vs nccgroup blog)
const DIV_CLASSES = [
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
	'article-refers', // theawl.com
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
	'author', // theweek.com
	'author_topics_holder', // The Irish Times
	'author-wrap', // Recode
	'author-info', // Streetwise
	'article-subtype', // theweek.com
	'big_story_tools_bottom_container', // Alternet
	'bio-socials', // Atomic Object
	'bizPagination', // Bizjournal
	'bk-socialbox', // Latin Post
	'bk-relart', // Latin Post
	'body-ad-1', // theweek.com
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
	'cb-post-meta', // neurosciencenews.com
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
	'el__leafmedia', // cnn.com
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
	'et_pb_subscribe', // unseenart.org
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
	'fsb-social-bar', // pyimagesearch.com
	'gh-header-actions', // Github
	'gh-header-meta', // Github
	'googleads', // Telegraph UK
	'group-link-categories', // Symmetry Magazine
	'group-links', // Symmetry Magazine
	'gsharebar', // entrepeneur.com
	'footer__body', // theawl.com
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
	'navbar', // queue.acm.org
	'navigation', // Renew Economy (may be problematic)
	'newsletterSignupBox', // NBC
	'newsreel', // The Wall Street Journal
	'next_on_news', // BuzzFeed
	'nextpost', // winteriscoming.net
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
	'post-footer', // *.blogspot.com
	'post-links', // Pro Football Talk
	'postmeta', // Windows Central
	'post-meta', // pyimagesearch.com
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
	'readability-sidebar', // Github
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
	'share-butts', // theawl.com
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
	'sp-slug', // theweek.com
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
	'submeta', // theguardian.com
	'submit-button', // Knight News Challenge
	'subnav-tools-wrap', // NPR
	'subscribe', // Times of India
	'subscribe-unit-mobile', // theweek.com
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
	'top-header', // winteriscoming.net
	'topic-category', // Bangkok Post
	'top-index-stories', // BBC
	'topkicker', // entrepreneur.com
	'toplinks', // VOA News
	'top-stories-range-module', // BBC
	'top-stories05', // Telegraph UK
	'trb_embed_related', // LA Times
	'trb_panelmod_body', //	LA Times
	'trb_ar_cr', // chicagotribune.com
	'twipsy', // St. Louis Today
	'upshot-social', // The New York Times
	'util-bar-flyout', // USA Today
	'utilities', // The Times
	'utility-bar', // USA Today
	'utility-panels', // WRAL
	'utils', // kotatv
	'utilsFloat', // KMBC
	'vce-related-box', // winteriscoming.net
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

const ANCHOR_CLASSES = [
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

const LIST_IDS = new Set([
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
]);

const LIST_CLASSES = [
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
	'trb_ar_rt', // chicagotribune.com
	'utility-list' // WRAL
];

const ASIDE_IDS = new Set([
	'asset-related', // St. Louis Today
	'bpage_ad_bottom', // BuzzFeed
	'connect', // pyimagesearch.com
	'fbookulous-flyer', // ProPublica
	'post_launch_success', // BuzzFeed
	'related-content-xs', // The Miami Herald
	'secondary-rail', // Dispatch.com
	'sidebar', // TechSpot
	'sidebar-read-more', // USA Today
	'story-related-topics' // AV Web
]);

const ASIDE_CLASSES = [
	'author-blocks', // ProPublica
	'itemAsideInfo', // The Guardian
	'bg-related', // The Boston Globe
	'callout', // The Atlantic
	'comments', // newhumanist.org.uk
	'control-widget', // newhumanist.org.uk
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
];

const P_CLASSES = [
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
];

const SECTION_IDS = new Set([
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
]);

const SECTION_CLASSES = [
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
];

const SPAN_CLASSES = [
	'span.comment-count-generated', // Teleread
	'span.fb-recommend-btn', // The Daily Voice
	'sharetools-label', // NY Time
	'moreon-tt', // Teleread
	'printfriendly-node', // Uncover California
	'story-date', // BBC Co Uk
	'text_resizer' // Fort Worth Star Telegram
];

const TABLE_CLASSES = [
	'hst-articleprinter', // Stamford Advocate
	'complexListingBox', // Mercury News
	'storyauthor', // SysCon Media
	'TopNavigation' // LWN
];

} // END ANONYMOUS NAMESPACE
