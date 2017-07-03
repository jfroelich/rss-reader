// See license.md

'use strict';

// TODO: style text quoted value
// TODO: xml entity declaration tag
// TODO: stricter rules on tag name immediately following <
// TODO: stricter rules on closing tag name and / (no preceding space)
// TODO: use one character tests, instead add more states
// TODO: unicode in js?
// TODO: html comments in script
// https://www.w3.org/TR/REC-html40/interact/scripts.html#h-18.3.2
// TODO: maybe improve performance by use charCodeAt instead of charAt and then
// doing comparisons using numbers, or is v8 using interning strings?
// TODO: allow for re-entrance, maybe add an optional initial state parameter
// to the function, if set use it other default to text state
// --- means probably need to return multiple things, including end state
// --- means not throwing if not in text state at end

// TODO: fix bugs with regular expression literals

// TODO: maybe add an onToken callback instead of array, and pass in two params,
// one for token type, this simplifies handling.


// NOTE: https://chromium.googlesource.com/chromium/blink.git/+
// /master/Source/core/html/parser/HTMLTokenizer.cpp
// NOTE: https://html.spec.whatwg.org/#tokenization

// Naively and semi-correctly tokenizes an arbitrary string of html.
// Style tags are grouped with style text content as a single token.
// Script tags are grouped together with script text as a single token.
// Entities are not distinguished from text and are not validated.
// To determine if a token is a tag, check if its first character is '<'
// @param inputString {String} any string
// @param inputState {Number} optional starting state
// @returns {Array} an array of strings, each is a token
// @throws {TypeError} is inputString is not a defined string-like object
// @throws {Error} if tokenization does not end in the default state, such as
// within a tag
function tokenizeHTML(inputString, inputState) {

  const inputStringLength = inputString.length;
  if(inputStringLength < 1) {
    return inputString;
  }

  let counter = 1;
  const STATE_TAG_OPEN = counter++;
  const STATE_TAG_CLOSE = counter++;
  const STATE_TEXT = counter++;
  const STATE_COMMENT = counter++;
  const STATE_TAG_SQATTRIBUTE = counter++;
  const STATE_TAG_DQATTRIBUTE = counter++;
  const STATE_TAG_OPEN_INSTRUCTION = counter++;
  const STATE_TAG_INSTRUCTION_END = counter++;
  const STATE_INSTRUCTION_SQATTRIBUTE = counter++;
  const STATE_INSTRUCTION_DQATTRIBUTE = counter++;
  const STATE_STYLE_TEXT = counter++;
  const STATE_STYLE_FORWARD_SLASH = counter++;
  const STATE_STYLE_MULTILINE_COMMENT = counter++;
  const STATE_STYLE_MULTILINE_COMMENT_STAR = counter++;
  const STATE_CDATA_START = counter++;
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

  let state = STATE_TEXT;

  if(inputState) {
    state = inputState;
  }

  const tokenArray = [];
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

        if(cursor === '/') {
          state = STATE_TAG_CLOSE;
        } else if(cursor === '!') {
          state = STATE_TAG_OPEN_BANG;
        } else if(cursor === '?') {
          state = STATE_TAG_OPEN_INSTRUCTION;
        } else if(cursor === 's' || cursor === 'S') {
          state = STATE_TAG_OPEN_NAME_S;
        } else {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        }

/*

        else if(cursor === '>') {
          if(token.length > 5 &&
            token.join('').toLowerCase().startsWith('<style')) {
            state = STATE_STYLE_TEXT;
          } else if(token.length > 6 &&
            token.join('').toLowerCase().startsWith('<script')) {
            state = STATE_SCRIPT_TEXT;
          } else {
            tokenArray.push(token.join(''));
            token.length = 0;
            state = STATE_TEXT;
          }
        }
*/
        break;
      case STATE_TAG_OPEN_BANG:
        // <!
        token.push(cursor);
        if(cursor === '-') {
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
        if(cursor === '-') {
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
          // End of CDATA section
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === ']') {
          // stay in this state and try again next iteration
          console.warn('TRIPLE BRACKET, STAYING IN SAME STATE');
        } else {
          // Retreat to treating the second bracket as the first
          state = STATE_CDATA;
        }
        break;

      case STATE_TAG_OPEN_NAME_GENERAL:
        token.push(cursor);
        // TODO: can - or _ be in tag name? what characters can be in tag name?
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(!/[a-z]/i.test(cursor)) {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;

      case STATE_TAG_OPEN_NAME_S:
        // <s
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'c' || cursor === 'C') {
          state = STATE_TAG_OPEN_NAME_SC;
        } else if(cursor === 't' || cursor === 'T') {
          state = STATE_TAG_OPEN_NAME_ST;
        } else if(/a-z/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }

        break;
      case STATE_TAG_OPEN_NAME_SC:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'r' || cursor === 'R') {
          state = STATE_TAG_OPEN_NAME_SCR;
        } else if(/a-z/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;
      case STATE_TAG_OPEN_NAME_SCR:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'i' || cursor === 'I') {
          state = STATE_TAG_OPEN_NAME_SCRI;
        } else if(/a-z/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;
      case STATE_TAG_OPEN_NAME_SCRI:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 'p' || cursor === 'P') {
          state = STATE_TAG_OPEN_NAME_SCRIP;
        } else if(/a-z/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;
      case STATE_TAG_OPEN_NAME_SCRIP:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === 't' || cursor === 'T') {
          state = STATE_TAG_OPEN_NAME_SCRIPT;
        } else if(/a-z/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME_GENERAL;
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;


        // TODO: stopped here, I do not like how many states this is involving,
        // it would be better to get to after tag name or >, then look back at
        // the token and rescan. There are just way too many states, and I
        // would have to repeat the quotes tests and everything.
        // maybe use 'inScript' and 'inStyle' variables to track additional
        // state. Only need to check and set them when entering or existing
        // so not too much overhead.

      case STATE_TAG_OPEN_NAME_ST:
        // TODO: <style
        break;
      case STATE_TAG_OPEN_AFTER_NAME:
        token.push(cursor);

        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(cursor === '"') {
          state = STATE_TAG_DQATTRIBUTE;
        } else if(cursor === '\'') {
          state = STATE_TAG_SQATTRIBUTE;
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
        } else {
          state = STATE_COMMENT_DASH;
        }
        break;
      case STATE_TAG_SQATTRIBUTE:
        token.push(cursor);
        if(cursor === "'") {
          state = STATE_TAG_OPEN;
        }
        break;
      case STATE_TAG_DQATTRIBUTE:
        token.push(cursor);
        if(cursor === '"') {
          state = STATE_TAG_OPEN;
        }
        break;
      case STATE_TAG_OPEN_INSTRUCTION:
        token.push(cursor);
        if(cursor === '"') {
          state = STATE_INSTRUCTION_DQATTRIBUTE;
        } else if(cursor === "'") {
          state = STATE_INSTRUCTION_SQATTRIBUTE;
        } else if(cursor === '?') {
          state = STATE_TAG_INSTRUCTION_END;
        }
        break;
      case STATE_TAG_INSTRUCTION_END:
        token.push(cursor);
        if(cursor === '>') {
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else {
          state = STATE_TAG_OPEN_INSTRUCTION;
        }
        break;
      case STATE_INSTRUCTION_SQATTRIBUTE:
        token.push(cursor);
        if(cursor === "'") {
          state = STATE_TAG_OPEN_INSTRUCTION;
        }
        break;
      case STATE_INSTRUCTION_DQATTRIBUTE:
        token.push(cursor);
        if(cursor === '"') {
          state = STATE_TAG_OPEN_INSTRUCTION;
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
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if(/\s/.test(cursor)) {
          state = STATE_TAG_CLOSE;
        } else {
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
        } else {
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
    throw new Error('Ended in invalid state: ' + state + ' ' +
      token.join(''));
  }

  return tokenArray;
}
