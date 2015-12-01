// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Style lib. Contains functions and global constants for
// updating the display of articles
// TODO: maybe use just one function for both load/change

// TODO: use an anonymous namespace

chrome.runtime.onMessage.addListener(function(message) {
	if(message && message.type === 'displaySettingsChanged') {
		updateEntryStyles();
	}
});

// todo: this is not yet in use, but the idea is to	remove media prefix
// as it is DRY
const BACKGROUND_PATH_BASE = '/media/';

const BACKGROUND_IMAGES = [
	'/media/bgfons-paper_texture318.jpg',
	'/media/CCXXXXXXI_by_aqueous.jpg',
	'/media/paper-backgrounds-vintage-white.jpg',
	'/media/pickering-texturetastic-gray.png',
	'/media/reusage-recycled-paper-white-first.png',
	'/media/subtle-patterns-beige-paper.png',
	'/media/subtle-patterns-cream-paper.png',
	'/media/subtle-patterns-exclusive-paper.png',
	'/media/subtle-patterns-groove-paper.png',
	'/media/subtle-patterns-handmade-paper.png',
	'/media/subtle-patterns-paper-1.png',
	'/media/subtle-patterns-paper-2.png',
	'/media/subtle-patterns-paper.png',
	'/media/subtle-patterns-rice-paper-2.png',
	'/media/subtle-patterns-rice-paper-3.png',
	'/media/subtle-patterns-soft-wallpaper.png',
	'/media/subtle-patterns-white-wall.png',
	'/media/subtle-patterns-witewall-3.png',
	'/media/thomas-zucx-noise-lines.png'
];

const FONT_FAMILIES = [
	'ArchivoNarrow-Regular',
	'Arial, sans-serif',
	'Calibri',
	'Calibri Light',
	'Cambria',
	'CartoGothicStd',
	//http://jaydorsey.com/free-traffic-font/
	//Clearly Different is released under the SIL Open Font License (OFL) 1.1.
	//Based on http://mutcd.fhwa.dot.gov/pdfs/clearviewspacingia5.pdf
	'Clearly Different',
	/* By John Stracke, Released under the OFL. Downloaded from his website */
	'Essays1743',
	// Downloaded free font from fontpalace.com, unknown author
	'FeltTip',
	'Georgia',
	'Montserrat',
	'MS Sans Serif',
	'News Cycle, sans-serif',
	'Noto Sans',
	'Open Sans Regular',
	'PathwayGothicOne',
	'PlayfairDisplaySC',
	'Raleway, sans-serif',
	// http://www.google.com/design/spec/resources/roboto-font.html
	'Roboto Regular'
];

// Note: Array.prototype.find requires Chrome 45+
function findCSSRule(sheet, selectorText) {
	return Array.prototype.find.call(sheet.cssRules, function(rule) {
		return rule.selectorText === selectorText;
	});
}

function updateEntryStyles() {
	// Assume a sheet is always available
	const sheet = document.styleSheets[0];

	const entryRule = findCSSRule(sheet, 'div.entry');
	if(entryRule) {
		if(localStorage.BACKGROUND_IMAGE) {
			entryRule.style.backgroundColor = '';
			entryRule.style.backgroundImage = 'url(' +
				localStorage.BACKGROUND_IMAGE + ')';
		} else if(localStorage.ENTRY_BACKGROUND_COLOR) {
			entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
			entryRule.style.backgroundImage = '';
		} else {
			entryRule.style.backgroundColor = '';
			entryRule.style.backgroundImage = '';
		}

		const entryMargin = localStorage.ENTRY_MARGIN || '10';
		entryRule.style.paddingLeft = entryMargin + 'px';
		entryRule.style.paddingRight = entryMargin + 'px';
	}

	const titleRule = findCSSRule(sheet,'div.entry a.entry-title');
	if(titleRule) {
		titleRule.style.background = '';
		titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
		const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
		if(hfs) {
			const hfsString = (hfs / 10).toFixed(2) + 'em';
			titleRule.style.fontSize = hfsString;
		}
	}

	const contentRule = findCSSRule(sheet, 'div.entry span.entry-content');
	if(contentRule) {
		contentRule.style.background = '';
		contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

		const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
		if(bfs) {
			contentRule.style.fontSize = (bfs / 10).toFixed(2) + 'em';
		}

		contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ?
			'justify' : 'left';

		const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
		contentRule.style.lineHeight = (bodyLineHeight / 10).toFixed(2);
		const columnCount = localStorage.COLUMN_COUNT;
		const VALID_COUNTS = { '1': true, '2': true, '3': true };
		if(!(columnCount in VALID_COUNTS)) {
			columnCount = '1';
		}

		contentRule.style.webkitColumnCount = parseInt(columnCount);
	}
}

function loadEntryStyles() {
	const sheet = document.styleSheets[0];
	let s = '';
	if(localStorage.BACKGROUND_IMAGE) {
		s += 'background: url('+ localStorage.BACKGROUND_IMAGE	+');';
	} else if(localStorage.ENTRY_BACKGROUND_COLOR) {
		s += 'background:'+ localStorage.ENTRY_BACKGROUND_COLOR+';';
	}

	s += 'margin: 0px;';

	const entryMargin = localStorage.ENTRY_MARGIN;
	if(entryMargin) {
		s += 'padding: ' + entryMargin + 'px;';
	}

	sheet.addRule('div.entry',s);
	s = '';
	const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
	if(hfs) {
		s += 'font-size:' + (hfs / 10).toFixed(2) + 'em;';
	}

	s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')	+';';
	s += 'letter-spacing: -0.03em;';
	s += 'color: rgba(50, 50, 50, 0.9);';
	s += 'text-decoration:none;';
	s += 'display:block;';
	s += 'word-wrap: break-word;';
	s += 'text-shadow: 1px 1px 2px #cccccc;';
	s += 'text-transform: capitalize;';
	s += 'margin: 0px';
	s += 'padding: 0px';

	sheet.addRule('div.entry a.entry-title', s);
	s = '';
	const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
	if(bfs) {
		s += 'font-size:' + (bfs / 10).toFixed(2) + 'em;';
	}

	const bodyTextJustify = localStorage.JUSTIFY_TEXT === '1';
	if(bodyTextJustify) {
		s += 'text-align: justify;';
	}

	const bodyFontFamily = localStorage.BODY_FONT_FAMILY;
	if(bodyFontFamily) {
		s += 'font-family:' + bodyFontFamily + ';';
	}

	let bodyLineHeight = localStorage.BODY_LINE_HEIGHT;
	if(bodyLineHeight) {
		bodyLineHeight = parseInt(bodyLineHeight);
		if(bodyLineHeight) {
			// TODO: units?
			s += 'line-height:' + (bodyLineHeight / 10).toFixed(2) + ';';
		}
	}

	s += 'vertical-align: text-top;';
	//s += 'letter-spacing: -0.03em;';
	//s += 'word-spacing: -0.5em;';
	s += 'display: block;';

	s += 'word-wrap: break-word;';

	// This is required to get long words without spaces to break when
	// within a table cell
	// http://stackoverflow.com/questions/1258416
	// http://stackoverflow.com/questions/1057574
	s += 'white-space: normal;';
	s += 'word-break: break-all;';

	s += 'padding-top: 20px;';
	s += 'padding-right: 0px;';
	s += 'padding-left: 0px;';
	s += 'padding-bottom: 20px;';
	s += 'margin: 0px;';
	// TODO: use this if columns enabled (use 1(none), 2, 3 as options).
	const columnCount = localStorage.COLUMN_COUNT;
	if(columnCount === '2' || columnCount === '3') {
		s += '-webkit-column-count: ' + columnCount + ';';
		s += '-webkit-column-gap: 30px;';
		s += '-webkit-column-rule: 1px outset #AAAAAA;';
	}

	sheet.addRule('div.entry span.entry-content', s);
}
