// See license.md

'use strict';

// TODO: style text quoted value
// TODO: xml entity declaration tag
// TODO: stricter rules on tag name immediately following <
// TODO: stricter rules on closing tag name and / (no preceding space)
// TODO: use one character tests, instead add more states
// TODO: unicode in js?
// TODO: html comments in script
// TODO: can - or _ be in tag name? what characters can be in tag name?
// https://www.w3.org/TR/REC-html40/interact/scripts.html#h-18.3.2
// TODO: maybe improve performance by use charCodeAt instead of charAt and then
// doing comparisons using numbers, or is v8 using interning strings?
// TODO: allow for re-entrance, maybe add an optional initial state parameter
// to the function, if set use it other default to text state
// --- means probably need to return multiple things, including end state
// --- means not throwing if not in text state at end

// TODO: fix bugs with regular expression literals

// TODO: maybe add an onToken callback instead of array, and pass in two params,
// one for token type, this simplifies handling. I don't like how the caller
// has to 'reparse' the string to determine the type. Also, it is kind of
// ambiguous like <script><!--, where <!-- leads off the script text token but
// is not a tag. Also, it makes it easier to tell start vs close because I
// could emit a token type along with the token value. also, I dont like the
// idea of this controlling the buffering, by using a callback i let the caller
// decide how long to hold on to previous tokens, instead of this demanding to
// hold onto the entire thing.

// TODO: maybe provide conditional verbose param that if set provides detailed
// logging to console?

// TODO: is this kind of brittle? Maybe a scanner generator tool would be
// better. Would need to research.

// TODO: isn't there a fundamental issue where if this differs from native
// handling of html, then that is a massive security risk.

// NOTE: https://chromium.googlesource.com/chromium/blink.git/+
// /master/Source/core/html/parser/HTMLTokenizer.cpp
// NOTE: https://html.spec.whatwg.org/#tokenization

// Tokenizes an arbitrary string of html. Makes some effort to comply with
// standards but does not fully comply.
// Entities are not distinguished from text and are not validated.
// To determine if a token is a tag, check if its first character is '<'
// @param inputString {String} any string
// @param inputState {Number} optional starting state
// @returns {Array} an array of strings, each is a token
// @throws {TypeError} is inputString is not a defined string-like object
// @throws {Error} if tokenization does not end in the default state, such as
// within a tag
function tokenizeHTML(inputString, inputState = 0) {

  // TODO: consider relaxing this type check to allow for string-like input
  if(typeof inputString !== 'string') {
    throw new TypeError('inputString must be of type "string", not "' +
      typeof inputString + '"');
  }

  const inputStringLength = inputString.length;
  if(inputStringLength < 1) {
    return [];
  }

  let counter = 1;

  // TODO: maybe rename to STATE_DATA as closer to spec terminology
  const STATE_TEXT = counter++;

  const STATE_TAG_OPEN = counter++;
  const STATE_TAG_OPEN_NAME = counter++;
  const STATE_TAG_OPEN_AFTER_NAME = counter++;
  const STATE_TAG_OPEN_BANG = counter++;
  const STATE_TAG_OPEN_BANG_DASH = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET_C = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET_CD = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET_CDA = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET_CDAT = counter++;
  const STATE_TAG_OPEN_BANG_BRACKET_CDATA = counter++;

  const STATE_TAG_OPEN_SQATTRIBUTE = counter++;
  const STATE_TAG_OPEN_DQATTRIBUTE = counter++;

  const STATE_TAG_CLOSE = counter++;


  const STATE_COMMENT = counter++;

  const STATE_STYLE_TEXT = counter++;
  const STATE_STYLE_FORWARD_SLASH = counter++;
  const STATE_STYLE_MULTILINE_COMMENT = counter++;
  const STATE_STYLE_MULTILINE_COMMENT_STAR = counter++;

  const STATE_CDATA = counter++;
  const STATE_CDATA_BRACKET = counter++;
  const STATE_CDATA_BRACKET_BRACKET = counter++;

  const STATE_SCRIPT_TEXT = counter++;
  const STATE_SCRIPT_BACKQUOTE = counter++;
  const STATE_SCRIPT_BACKQUOTE_ESCAPE = counter++;
  const STATE_SCRIPT_SINGLEQUOTE = counter++;
  const STATE_SCRIPT_SINGLEQUOTE_ESCAPE = counter++;
  const STATE_SCRIPT_DOUBLEQUOTE = counter++;
  const STATE_SCRIPT_DOUBLEQUOTE_ESCAPE = counter++;
  const STATE_SCRIPT_FORWARD_SLASH = counter++;
  const STATE_SCRIPT_SINGLE_LINE_COMMENT = counter++;
  const STATE_SCRIPT_MULTILINE_COMMENT = counter++;
  const STATE_SCRIPT_MULTILINE_COMMENT_CLOSING = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_S = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SC = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCR = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRI = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIP = counter++;
  const STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIPT = counter++;

  const STATE_SCRIPT_REGULAR_EXPRESS_LITERAL = counter++;
  const STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE = counter++;



  // Set the initial state
  let state = inputState || STATE_TEXT;

  // Buffer of all output tokens
  const tokenArray = [];

  // Buffer of characters of current token
  let token = [];

  for(let index = 0; index < inputStringLength; index++) {

    const cursor = inputString.charAt(index);

    switch(state) {
      case STATE_TEXT:
        if(cursor === '<') {
          if(token.length) {
            tokenArray.push(token.join(''));
            token.length = 0;
          }
          state = STATE_TAG_OPEN;
          token.push(cursor);
        } else {
          token.push(cursor);
        }
        break;
      case STATE_TAG_OPEN:
        token.push(cursor);

        if(cursor === '>') {
          // <>
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '/') {
          // </
          state = STATE_TAG_CLOSE;
        } else if(cursor === '!') {
          state = STATE_TAG_OPEN_BANG;
        } else if(cursor === '?') {
          // <?
          // Start of processing instruction
          state = STATE_TAG_OPEN_NAME;
        } else if(/[a-z]/i.test(cursor)) {
          // <character
          state = STATE_TAG_OPEN_NAME;
        } else {
          // NOTE: do not allow leading spaces before a tag name, so if this
          // is a space it is still not valid.
          // Possibly an unencoded < in plain text
          console.warn('Unrecognized tag name at character', cursor,
            ' so reverting to text, token is', token.join(''));
          state = STATE_TEXT;
        }

        break;
      case STATE_TAG_OPEN_BANG:
        // <!
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '-') {
          // <!-
          state = STATE_TAG_OPEN_BANG_DASH;
        } else if(cursor === '[') {
          // <![
          state = STATE_TAG_OPEN_BANG_BRACKET;
        }
        break;
      case STATE_TAG_OPEN_BANG_DASH:
        // <!-
        token.push(cursor);

        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '-') {
          // <!--
          state = STATE_COMMENT;
        } else {
          // <!-? Malformed?
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET:
        // <![
        token.push(cursor);
        if(cursor === '>') {
          // <![>
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'c' || cursor === 'C') {
          state = STATE_TAG_OPEN_BANG_BRACKET_C;
        } else {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_C:
        // <![c
        token.push(cursor);
        if(cursor === '>') {
          // <![c>
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'd' || cursor === 'D') {
          // <![cd
          state = STATE_TAG_OPEN_BANG_BRACKET_CD;
        } else {
          // <![c?
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CD:
        // <![cd
        token.push(cursor);
        if(cursor === '>') {
          // <![cd>
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'a' || cursor === 'A') {
          // <![cda
          state = STATE_TAG_OPEN_BANG_BRACKET_CDA;
        } else {
          // <![cd?
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDA:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 't' || cursor === 'T') {
          state = STATE_TAG_OPEN_BANG_BRACKET_CDAT;
        } else {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDAT:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'a' || cursor === 'A'){
          state = STATE_TAG_OPEN_BANG_BRACKET_CDATA;
        } else {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDATA:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '[') {
          state = STATE_CDATA;
        }
        break;
      case STATE_CDATA:
        token.push(cursor);
        if(cursor === ']') {
          state = STATE_CDATA_BRACKET;
        }
        break;
      case STATE_CDATA_BRACKET:
        token.push(cursor);
        if(cursor === ']') {
          // ]]
          state = STATE_CDATA_BRACKET_BRACKET;
        } else {
          state = STATE_CDATA;
        }
        break;
      case STATE_CDATA_BRACKET_BRACKET:
        // ]]{cursor}
        token.push(cursor);
        if(cursor === '>') {
          // ]]>
          // End of CDATA section
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === ']') {
          // ]]]
          // TODO: test this, not sure if correct
          // Retreat to treating the second bracket as the first
          // stay in this state and try again next iteration
          console.warn('TRIPLE BRACKET, STAYING IN SAME STATE');
        } else {
          state = STATE_CDATA;
        }
        break;
      case STATE_TAG_OPEN_NAME:
        token.push(cursor);

        const SCRIPT_NAME_LENGTH = 'script'.length;
        const STYLE_NAME_LENGTH = 'style'.length;

        if(cursor === '>') {

          let tagNameWithSigns = token.join('');

          if(token.length === (SCRIPT_NAME_LENGTH + 2) &&
            /<script>/i.test(tagNameWithSigns)) {

            // Emit the <script> token
            tokenArray.push(token.join(''));
            token.length = 0;

            state = STATE_SCRIPT_TEXT;
          } else if(token.length === (STYLE_NAME_LENGTH + 2) &&
            /<style>/i.test(tagNameWithSigns)) {

            // Emit the <style> token
            tokenArray.push(token.join(''));
            token.length = 0;
            state = STATE_STYLE_TEXT;

          } else {
            // Closing of a general named tag
            tokenArray.push(token.join(''));
            token.length = 0;
            state = STATE_TEXT;
          }

        } else if(/[a-z]/i.test(cursor)) {
          // stay in tag name
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;

      case STATE_TAG_OPEN_AFTER_NAME:
        token.push(cursor);

        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '"') {
          state = STATE_TAG_OPEN_DQATTRIBUTE;
        } else if(cursor === '\'') {
          state = STATE_TAG_OPEN_SQATTRIBUTE;
        }

        break;
      case STATE_TAG_CLOSE:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        }
        break;
      case STATE_COMMENT:
        token.push(cursor);

        if(cursor === '-') {
          state = STATE_COMMENT_DASH;
        }
        break;
      case STATE_COMMENT_DASH:
        token.push(cursor);
        if(cursor === '-') {
          state = STATE_COMMENT_DASH_DASH;
        } else {
          state = STATE_COMMENT;
        }
        break;
      case STATE_COMMENT_DASH_DASH:
        token.push(cursor);
        if(cursor === '>') {
          // -->
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '-') {
          // ---
          state = STATE_COMMENT_DASH;
        } else {
          // --?
          state = STATE_COMMENT;
        }
        break;
      case STATE_TAG_OPEN_SQATTRIBUTE:
        token.push(cursor);
        if(cursor === "'") {
          state = STATE_TAG_OPEN;
        }
        break;
      case STATE_TAG_OPEN_DQATTRIBUTE:
        token.push(cursor);
        if(cursor === '"') {
          state = STATE_TAG_OPEN;
        }
        break;

      case STATE_STYLE_TEXT:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else if(cursor === '<') {
          state = STATE_TAG_CLOSE;
        }
        break;
      case STATE_STYLE_FORWARD_SLASH:
        token.push(cursor);
        if(cursor === '*') {
          state = STATE_STYLE_MULTILINE_COMMENT;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_MULTILINE_COMMENT:
        token.push(cursor);
        if(cursor === '*') {
          state = STATE_STYLE_MULTILINE_COMMENT_STAR;
        }
        break;
      case STATE_STYLE_MULTILINE_COMMENT_STAR:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_STYLE_TEXT;
        } else {
          state = STATE_STYLE_MULTILINE_COMMENT;
        }
        break;

      case STATE_SCRIPT_TEXT:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_SCRIPT_FORWARD_SLASH;
        } else if(cursor === '<') {
          state = STATE_SCRIPT_LESS_THAN_SIGN;
        } else if(cursor === '\'') {
          state = STATE_SCRIPT_SINGLEQUOTE;
        } else if(cursor === '"') {
          state = STATE_SCRIPT_DOUBLEQUOTE;
        } else if(cursor === '`'){
          state = STATE_SCRIPT_BACKQUOTE;
        }
        break;
      case STATE_SCRIPT_SINGLEQUOTE:
        token.push(cursor);
        if(cursor === '\\') {
          state = STATE_SCRIPT_SINGLEQUOTE_ESCAPE;
        } else if(cursor === '\'') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_SINGLEQUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_SINGLEQUOTE;
        break;
      case STATE_SCRIPT_DOUBLEQUOTE:
        token.push(cursor);
        if(cursor === '\\') {
          state = STATE_SCRIPT_DOUBLEQUOTE_ESCAPE;
        } else if(cursor === '"') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_DOUBLEQUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_DOUBLEQUOTE;
        break;
      case STATE_SCRIPT_BACKQUOTE:
        // TODO: not entirely clear on template syntax regarding escapes
        // nested backquotes and nested expressions
        token.push(cursor);
        if(cursor === '\\') {
          state = STATE_SCRIPT_BACKQUOTE_ESCAPE;
        } else if(cursor === '`') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_BACKQUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_BACKQUOTE;
        break;
      case STATE_SCRIPT_FORWARD_SLASH:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_SCRIPT_SINGLE_LINE_COMMENT;
        } else if(cursor === '*') {
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        } else {
          // TODO: Either a division symbol, or start of regular expression
          // literal, or malformed
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH;
        } else {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH:
        // Was in script text and encountered </
        // This could be:
        // The start of and end tag
        // Whitespace preceding an variable name or value
        // The start of an variable name or value
        // Parens
        // unicode
        // a second < in bitshift case
        // Something malformed (javascript syntax error)

        if(cursor === '/') {
          // <//
          token.push(cursor);
          state = STATE_SCRIPT_SINGLE_LINE_COMMENT;
        } else if(cursor === '*') {
          // </*
          token.push(cursor);
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        } else if(cursor === 's' || cursor === 'S') {
          // </script
          // TODO: actually this could be a regular expression literal...?
          // so we have to go all the way to </script>
          // </script [justkidding]$/i.test("uhoh") ? 0:0 ....
          token.push(cursor);
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_S
        } else {
          // Either a division symbol, regexp, or malformed syntax
          // TODO: do I need to branch into regexp here? ambiguous
          token.push(cursor);
          state = STATE_SCRIPT_TEXT;
        }

        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_S:
        token.push(cursor);
        if(cursor === 'c' || cursor === 'C') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SC;
        } else {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SC:
        token.push(cursor);
        if(cursor === 'r' || cursor === 'R') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCR;
        } else {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCR:
        token.push(cursor);
        if(cursor === 'i' || cursor === 'I') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRI;
        } else {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRI:
        token.push(cursor);
        if(cursor === 'p' || cursor === 'P') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIP;
        } else {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIP:
        token.push(cursor);
        if(cursor === 't' || cursor === 'T') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIPT;
        } else {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIPT:

        token.push(cursor);
        if(cursor === '>') {

          // TODO: at this point the token still has the SCRIPT_TEXT characters
          // in it. I basically need to produce two tokens at this point, one
          // for script text and one for the closing script tag

          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(/\s/.test(cursor)) {
          // TODO: actually this might not work because again the SCRIPT_TEXT
          // is a part of the token along with the closing tag
          state = STATE_TAG_CLOSE;
        } else {
          // This was not a closing script tag, it was a part of a
          // partially-scanned regular expression literal
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_SINGLE_LINE_COMMENT:
        token.push(cursor);
        // TODO: is checking for carriage return appropriate?
        if(cursor === '\r' || cursor === '\n') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_MULTILINE_COMMENT:
        token.push(cursor);
        if(cursor === '*') {
          state = STATE_SCRIPT_MULTILINE_COMMENT_CLOSING;
        }
        break;
      case STATE_SCRIPT_MULTILINE_COMMENT_CLOSING:
        token.push(cursor);
        if(cursor === '/') {
          state = STATE_SCRIPT_TEXT;
        } else if(cursor === '*') {
          // Stay in the same state, we encountered **, so the first star
          // is not closing, but the second could be and we will find out on
          // next iteration.
        } else {
          // Encountered a * following by an unknown character, revert back to
          // comment state, this * was not a closing star.
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        }
        break;
      case STATE_SCRIPT_REGULAR_EXPRESS_LITERAL:
        token.push(cursor);
        if(cursor === '\\') {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE;
        } else if(cursor === '/') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
        break;
      default:
        throw new Error('Unknown state: ' + state);
    } // end switch statement
  } // end for loop

  // Handle the final token
  if(token.length) {
    tokenArray.push(token.join(''));
  }

  if(state !== STATE_TEXT) {
    throw new Error('Ended in invalid state ' + state + ' with token ' +
      token.join(''));
  }

  return tokenArray;
}
