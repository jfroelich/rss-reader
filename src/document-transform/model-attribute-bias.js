// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Analyzes element attribute values, excluding microdata.

// TODO: some of the tokens in the map are probably single id or
// singe class clases that do not belong in the map, like articleContent

// TODO: the single class matchers and such are no longer correct to use
// given that we use the fast path in the main calamine func

// TODO: this should be called an exetractor and return a map or something
// that contains the extracted features, rather than modifying score

// TODO: this isn't a document transform, calamine is no longer a document
// transform, so this belongs in a separate location

{ // BEGIN ANONYMOUS NAMESPACE

const ATTRIBUTE_BIAS = new Map([
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
	['categories', -50],
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
	['contentpane', 200],
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
	['post', 300],
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

function modelAttributeBias(document, scores, annotate) {
	const elements = document.querySelectorAll(
		'aside, div, section, span');
	Array.prototype.forEach.call(elements,
		applyElementAttributeBias.bind(null, scores, annotate));
	applySingleClassBias(document, scores, annotate, 'article', 1000);
	applySingleClassBias(document, scores, annotate, 'articleText', 1000);
	applySingleClassBias(document, scores, annotate, 'articleBody', 1000);
}

// Export into global scope
this.modelAttributeBias = modelAttributeBias;

// Looks for delimiting characters
// TODO: split on case-transition (lower2upper,upper2lower)
const ATTRIBUTE_SPLIT = /[\s\-_0-9]+/g;

function applyElementAttributeBias(scores, annotate, element) {
	const values = [element.id, element.name, element.className].join(' ');
	if(values.length < 3) return;
	const tokens = new Set(values.toLowerCase().split(ATTRIBUTE_SPLIT));
	let bias = 0;
	for(let token of tokens) {
		bias += ATTRIBUTE_BIAS.get(token) || 0;
	}
	if(!bias) return;
	scores.set(element, scores.get(element) + bias);
	if(annotate)
		element.dataset.attributeBias = bias.toString();
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

} // END ANONYMOUS NAMESPACE
