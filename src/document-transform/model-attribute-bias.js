// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// This is a component module of Calamine that weights the content of
// document elements according to the values of each element's
// attributes. The weighting here is primarily for determining whether
// an element is the ideal root element, not whether each element's
// content is individually boilerplate.

// TODO: improve performance, this is one of the slowest parts
// TODO: itemscope?
// TODO: itemprop="articleBody"?
// TODO: [role="article"]?
// TODO: split on case-transition (lower2upper,upper2lower)

// I am getting very strange profiling results and I have no idea why.
// Therefore, this is written to use fewer ES6 features until I can
// track down what the hell Chrome is doing to the code. Because it is
// doing something very incorrectly.
// NOTE: currently, the profiler is displaying tokenize2 as appearing
// both within getAttributeBias and within scoreElement, and notably,
// it is very fast within getAttributeBias and ridiculously slow in
// scoreElement. But I never call tokenize2 from within scoreElement
// so I am entirely lost. It is also bringing up external modules
// declared in other files as being subsets of this code..??

// NOTE: cannot yet use for..of because Chrome whines about de-opts
// NOTE: cannot yet use const/let because Chrome whines about
// Unsupported phi use of const variable and Unsupported compound let
// statement

// TODO: make tokenize a parameter to this function, and specify
// the two strategies externally, and allow the caller to choose
// which strategy to use? Or do I want to pick one strategy and
// stick to it?

function modelAttributeBias(document, scores, annotate) {

	var CALAMINE$ATTRIBUTE_BIAS = new Map([
		['about', -35],
		['ad', -100],
		['ads', -50],
		['advert', -200],
		['artext1',100],
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
		['blogpost', 500], // Seen as itemprop value
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
		['complementary', -100], // Seen as role
		['component', -50],
		['contact', -50],
		['content', 100],
		['contentpane', 200], // Google Plus
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
		['hnews', 200],
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
		['newscontent', 500],
		['newsletter', -100],
		['next', -300],
		['nfarticle', 500],
		['page', 50],
		['pagetools', -50],
		['parse', -50],
		['pinnion', 50],
		['popular', -50],
		['popup', -100],
		['post', 150],
		['power', -100],
		['prev', -300],
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
		['storycontent', 500],
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
		['topheader', -300],
		['toptabs', -200],
		['twitter', -200],
		['txt', 50],
		['utility', -50],
		['vcard', -50],
		['week', -100],
		['welcome', -50],
		['widg', -200],
		['widget', -200],
		['wnstorybody', 1000],
		['zone', -50]
	]);

	var scorableElements = document.querySelectorAll(
		'aside, div, section, span');
	Array.prototype.forEach.call(scorableElements,
		scoreElement.bind(null, scores, annotate));

	function scoreElement(scores, annotate, element) {
		var bias = getAttributeBias(element);
		if(!bias) return;
		scores.set(element, scores.get(element) + bias);

		// Assume scorer visits only once
		if(annotate) {
			element.dataset.attributeBias = bias.toString();
		}
	}

	function getAttributeBias(element) {

		// NOTE: Chrome is whining about compound let statements even though there
		// are none in this code, probably due to some buggy term rewriting, so
		// using var
		// NOTE: we cannot yet use for..of over the token array because Chrome
		// de-opts

		var concatenatedValues = getAttributesAsString(element);

		// We have two tokenize strategies available. Right now tokenize2
		// seems to yield better performance tokenize1.

		var tokenSet = tokenize2(concatenatedValues);

		// Revert back to an array due to for..of deopt issue
		var tokenArray = Array.from(tokenSet);

		var tokenArrayLength = tokenArray.length;
		var bias = 0;
		for(var i = 0; i < tokenArrayLength; i++) {
			bias += CALAMINE$ATTRIBUTE_BIAS.get(tokenArray[i]) || 0;
		}

		return bias;
	}

	// Returns a subset of an element's attribute values as a concatenated
	// string. This is currently isolated to allow for simpler performance
	// testing.
	// Note: preliminary perf testing shows that this does not seem
	// to be the main cause of the poor performance
	// TODO: test whether join or append is faster
	// NOTE: accessing properties appears to be faster than accessing
	// attributes
	function getAttributesAsString(element) {
		return (element.id || '') +
			(element.name || '') +
			(element.className || '') +
			(element.getAttribute('itemprop') || '');
	}

	// Used by tokenize1, this pattern looks for delimiting characters
	var CALAMINE$ATTRIBUTE_SPLIT = /[\s\-_0-9]+/g;

	// Split up an attribute value using a RegExp
	// Note that unlike tokenize2, this yields empty strings as values
	// in the array, these are not filtered here, but the set of empties
	// is aggregated as one value in the set, which basically means each
	// set produced by this may have one extra value that is empty. I
	// believe the perf impact is negligible and it isn't worth filtering
	// out the empty values
	function tokenize1(string) {

		var lowercaseString = string.toLowerCase();
		var tokenArray = lowercaseString.split(CALAMINE$ATTRIBUTE_SPLIT);
		var tokenSet = new Set(tokenArray);
		return tokenSet;
	}

	// Split up an attribute value using plain for loop
	// The idea here is that for some reason the RegExp is erratically slow
	// and that a simplistic character walk may be faster. Given that RegExp
	// is all native, I am not sure why this is ever faster, but testing shows
	// that it frequently is faster. I need to do more tests.

	// NOTE: using for instead of for of due to strange deopt
	// NOTE: using var due to strange deopt

	function tokenize2(string) {
		var tokens = new Set();
		var token = [];
		var joined = '';
		var stringLength = string.length;
		var c = '';

		for(var i = 0; i < stringLength; i++) {
			c = string.charAt(i);
			if(c === ' ' || c === '-' || c === '_' || (c >= '0' && c <= '9')) {
				if(token.length) {
					joined = token.join('');
					if(joined) {
						tokens.add(joined);
						token = [];
					}
				}
			} else if(c >= 'A' && c <= 'Z') {
				// Rather than lowercase the entire string, which is locale
				// sensitive, we hardcode change the English subset here,
				// because our weighted values set we compare against is
				// a restricted vocab
				token.push(String.fromCharCode(c.charCodeAt(0) + 32));
			} else {
				token.push(c);
			}
		}

		// Add the final token
		if(token.length) {
			joined = token.join('');
			if(joined) {
				tokens.add(joined);
			}
		}

		return tokens;
	}



	function applySingleClassBias(document, scores, annotate, className, bias) {
		const elements = document.getElementsByClassName(className);
		if(elements.length !== 1) return;

		const element = elements[0];
		scores.set(element, scores.get(element) + bias);
		if(annotate) {
			let previousBias = parseFloat(element.dataset.attributeBias) || 0.0;
			element.dataset.attributeBias = previousBias + bias;
		}
	}

	// Pathological attribute scoring cases
	applySingleClassBias(document, scores, annotate, 'article', 1000);
	applySingleClassBias(document, scores, annotate, 'articleText', 1000);
	applySingleClassBias(document, scores, annotate, 'articleBody', 1000);


	const MD_SCHEMAS = [
		'Article',
		'Blog',
		'BlogPost',
		'BlogPosting',
		'NewsArticle',
		'ScholarlyArticle',
		'TechArticle',
		'WebPage'
	];

	function applySchemaBias(document, scores, annotate, schema) {

		const selector = '[itemtype="http://schema.org/' + schema + '"]';
		const elements = document.querySelectorAll(selector);
		if(elements.length !== 1) return;
		const element = elements[0];
		scores.set(element, scores.get(element) + 500);
		if(annotate) {
			element.dataset.itemTypeBias = 500;
		}
	}

	// Microdata attribute scoring
	MD_SCHEMAS.forEach(applySchemaBias.bind(null,
		document, scores, annotate));


} // END FUNCTION
