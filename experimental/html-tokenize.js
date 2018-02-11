// Tokenizes an arbitrary string of html. Makes some effort to comply with
// standards but does not fully comply.
// Entities are not distinguished from text and are not validated.
// To determine if a token is a tag, check if its first character is '<'
// @param htmlString {String} any string
// @param inputState {Number} optional starting state
// @returns {Array} an array of strings, each is a token
// @throws {TypeError} is htmlString is not a defined string-like object
// @throws {Error} if tokenization does not end in the default state, such as
// within a tag
export function tokenizeHTML(htmlString, inputState = 0) {
  assert(typeof htmlString === 'string');

  const inputStringLength = htmlString.length;
  if (inputStringLength < 1) {
    return [];
  }

  let counter = 1;

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
  const STATE_COMMENT_DASH = counter++;
  const STATE_COMMENT_DASH_DASH = counter++;

  const STATE_STYLE_TEXT = counter++;
  const STATE_STYLE_SINGLE_QUOTE = counter++;
  const STATE_STYLE_SINGLE_QUOTE_ESCAPE = counter++;
  const STATE_STYLE_DOUBLE_QUOTE = counter++;
  const STATE_STYLE_DOUBLE_QUOTE_ESCAPE = counter++;

  const STATE_STYLE_FORWARD_SLASH = counter++;
  const STATE_STYLE_MULTILINE_COMMENT = counter++;
  const STATE_STYLE_MULTILINE_COMMENT_STAR = counter++;
  const STATE_STYLE_LESS_THAN_SIGN = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_S = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_ST = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STY = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYL = counter++;
  const STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYLE = counter++;

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

  const STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL = counter++;
  const STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE = counter++;

  // Set the initial state
  let state = inputState || STATE_TEXT;

  // Buffer of all output tokens
  const tokens = [];

  // Buffer of characters of current token
  let token = [];

  for (let index = 0; index < inputStringLength; index++) {
    const cursor = htmlString.charAt(index);

    switch (state) {
      case STATE_TEXT:
        if (cursor === '<') {
          if (token.length) {
            tokens.push(token.join(''));
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

        if (cursor === '>') {
          // <>
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '/') {
          state = STATE_TAG_CLOSE;  // </
        } else if (cursor === '!') {
          state = STATE_TAG_OPEN_BANG;
        } else if (cursor === '?') {
          state = STATE_TAG_OPEN_NAME;  // <? Start of pi
        } else if (/[a-z]/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME;  // <character
        } else {
          // We do not allow leading spaces before a tag name, so if this
          // is a space it is not valid. Possibly an unencoded < in plain text
          state = STATE_TEXT;
        }
        break;
      case STATE_TAG_OPEN_BANG:
        // <!
        token.push(cursor);
        if (cursor === '>') {
          // <!>
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '-') {
          state = STATE_TAG_OPEN_BANG_DASH;  // <!-
        } else if (cursor === '[') {
          state = STATE_TAG_OPEN_BANG_BRACKET;  // <![
        } else if (/[a-z]/i.test(cursor)) {
          state = STATE_TAG_OPEN_NAME;  // <!DOCTYPE
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_DASH:
        token.push(cursor);  // <!-
        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '-') {
          state = STATE_COMMENT;  // <!--
        } else {
          // <!-? Malformed?
          // TODO: should i distinguish between open name and open after name
          // here based on whether it is whitespace?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET:
        // <![
        token.push(cursor);
        if (cursor === '>') {
          // <![>
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === 'c' || cursor === 'C') {
          state = STATE_TAG_OPEN_BANG_BRACKET_C;
        } else {
          // TODO: distinguish between name and after name states here?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_C:
        // <![c
        token.push(cursor);
        if (cursor === '>') {
          // <![c>
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === 'd' || cursor === 'D') {
          // <![cd
          state = STATE_TAG_OPEN_BANG_BRACKET_CD;
        } else {
          // <![c?
          // TODO: distinguish between name and after name states here?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CD:
        // <![cd
        token.push(cursor);
        if (cursor === '>') {
          // <![cd>
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === 'a' || cursor === 'A') {
          // <![cda
          state = STATE_TAG_OPEN_BANG_BRACKET_CDA;
        } else {
          // <![cd?
          // TODO: distinguish between name and after name states here?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDA:
        token.push(cursor);
        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === 't' || cursor === 'T') {
          state = STATE_TAG_OPEN_BANG_BRACKET_CDAT;
        } else {
          // TODO: distinguish between name and after name states here?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDAT:
        token.push(cursor);
        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === 'a' || cursor === 'A') {
          state = STATE_TAG_OPEN_BANG_BRACKET_CDATA;
        } else {
          // TODO: distinguish between name and after name states here?
          state = STATE_TAG_OPEN_NAME;
        }
        break;
      case STATE_TAG_OPEN_BANG_BRACKET_CDATA:
        // TODO: distinguish between name and after name states here?
        // TODO: handle open name and after name states correctly, check for
        // space
        token.push(cursor);
        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '[') {
          state = STATE_CDATA;
        }
        break;
      case STATE_CDATA:
        token.push(cursor);
        if (cursor === ']') {
          state = STATE_CDATA_BRACKET;
        }
        break;
      case STATE_CDATA_BRACKET:
        token.push(cursor);
        if (cursor === ']') {
          // ]]
          state = STATE_CDATA_BRACKET_BRACKET;
        } else {
          state = STATE_CDATA;
        }
        break;
      case STATE_CDATA_BRACKET_BRACKET:
        // ]]{cursor}
        token.push(cursor);
        if (cursor === '>') {
          // ]]>
          // End of CDATA section
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === ']') {
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

        if (cursor === '>') {
          // TODO: these conditions also need to happen in tag open after name
          // state

          let tagNameWithSigns = token.join('');

          if (token.length === (SCRIPT_NAME_LENGTH + 2) &&
              /<script>/i.test(tagNameWithSigns)) {
            // Emit the <script> token
            tokens.push(token.join(''));
            token.length = 0;

            state = STATE_SCRIPT_TEXT;
          } else if (
              token.length === (STYLE_NAME_LENGTH + 2) &&
              /<style>/i.test(tagNameWithSigns)) {
            // Emit the <style> token
            tokens.push(token.join(''));
            token.length = 0;
            state = STATE_STYLE_TEXT;

          } else {
            // Closing of a general named tag
            tokens.push(token.join(''));
            token.length = 0;
            state = STATE_TEXT;
          }

        } else if (/[a-z]/i.test(cursor)) {
          // stay in tag name
        } else {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;

      case STATE_TAG_OPEN_AFTER_NAME:
        token.push(cursor);

        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '"') {
          state = STATE_TAG_OPEN_DQATTRIBUTE;
        } else if (cursor === '\'') {
          state = STATE_TAG_OPEN_SQATTRIBUTE;
        }
        break;
      case STATE_TAG_CLOSE:
        token.push(cursor);

        // TODO: no whitespace before tag name
        // TODO: whitespace after tag name

        if (cursor === '>') {
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        }
        break;
      case STATE_COMMENT:
        token.push(cursor);

        if (cursor === '-') {
          state = STATE_COMMENT_DASH;
        }
        break;
      case STATE_COMMENT_DASH:
        token.push(cursor);
        if (cursor === '-') {
          state = STATE_COMMENT_DASH_DASH;
        } else {
          state = STATE_COMMENT;
        }
        break;
      case STATE_COMMENT_DASH_DASH:
        token.push(cursor);
        if (cursor === '>') {
          // -->
          tokens.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (cursor === '-') {
          // ---
          // Stay in this state. Now treat the last two dashes as possibly
          // terminating
          state = STATE_COMMENT_DASH_DASH;
        } else {
          // --?
          state = STATE_COMMENT;
        }
        break;
      case STATE_TAG_OPEN_SQATTRIBUTE:
        token.push(cursor);
        if (cursor === '\'') {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;
      case STATE_TAG_OPEN_DQATTRIBUTE:
        token.push(cursor);
        if (cursor === '"') {
          state = STATE_TAG_OPEN_AFTER_NAME;
        }
        break;

      case STATE_STYLE_TEXT:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '\'') {
          state = STATE_STYLE_SINGLE_QUOTE;
        } else if (cursor === '"') {
          state = STATE_STYLE_DOUBLE_QUOTE;
        } else {
          // Stay in this state
        }
        break;
      case STATE_STYLE_SINGLE_QUOTE:
        token.push(cursor);
        if (cursor === '\\') {
          state = STATE_STYLE_SINGLE_QUOTE_ESCAPE;
        } else if (cursor === '\'') {
          state = STATE_STYLE_TEXT;
        } else {
          // Stay in this state
        }
        break;
      case STATE_STYLE_SINGLE_QUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_STYLE_SINGLE_QUOTE;
        break;
      case STATE_STYLE_DOUBLE_QUOTE:
        token.push(cursor);
        if (cursor === '\\') {
          state = STATE_STYLE_DOUBLE_QUOTE_ESCAPE;
        } else if (cursor === '"') {
          state = STATE_STYLE_TEXT;
        } else {
          // Stay in this state
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN:
        token.push(cursor);
        if (cursor === '<') {
          // Stay in same state
        } else if (cursor === '/') {
          // Go to next state of possible closing style tag
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH;
        } else {
          // Revert back to style text
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH:
        token.push(cursor);
        if (cursor === 's' || cursor === 'S') {
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_S;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '*') {
          // </* means a bad < followed by start of comment
          state = STATE_STYLE_MULTILINE_COMMENT;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_S:
        token.push(cursor);
        if (cursor === 't' || cursor === 'T') {
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_ST;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_ST:
        token.push(cursor);
        if (cursor === 'y' || cursor === 'Y') {
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STY;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STY:
        token.push(cursor);
        if (cursor === 'l' || cursor === 'L') {
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYL;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYL:
        token.push(cursor);
        if (cursor === 'e' || cursor === 'E') {
          state = STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYLE;
        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_LESS_THAN_SIGN_FORWARD_SLASH_STYLE:
        token.push(cursor);
        if (cursor === '>') {
          const styleEndTagLength = '</style>'.length;

          // We only have some text if the token is longer than the end tag
          if (token.length > styleEndTagLength) {
            const styleText = token.slice(0, -1 * styleEndTagLength);
            tokens.push(styleText.join(''));
          }

          // Append the closing tag token
          const closingTagText = token.slice(-1 * styleEndTagLength);
          tokens.push(closingTagText.join(''));

          // Reset the token
          token.length = 0;
          // Revert to normal state
          state = STATE_TEXT;

        } else if (cursor === '<') {
          state = STATE_STYLE_LESS_THAN_SIGN;
        } else if (cursor === '/') {
          state = STATE_STYLE_FORWARD_SLASH;
        } else if (/\s/.test(cursor)) {
          // Stay in this state. This allows for arbitrary whitespace after
          // style closing tag name preceding >
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_FORWARD_SLASH:
        token.push(cursor);
        if (cursor === '*') {
          state = STATE_STYLE_MULTILINE_COMMENT;
        } else if (cursor === '/') {
          // Stay in this state
        } else {
          state = STATE_STYLE_TEXT;
        }
        break;
      case STATE_STYLE_MULTILINE_COMMENT:
        token.push(cursor);
        if (cursor === '*') {
          state = STATE_STYLE_MULTILINE_COMMENT_STAR;
        }
        break;
      case STATE_STYLE_MULTILINE_COMMENT_STAR:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_STYLE_TEXT;
        } else if (cursor === '*') {
          // Stay in this state
        } else {
          state = STATE_STYLE_MULTILINE_COMMENT;
        }
        break;
      case STATE_SCRIPT_TEXT:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_SCRIPT_FORWARD_SLASH;
        } else if (cursor === '<') {
          state = STATE_SCRIPT_LESS_THAN_SIGN;
        } else if (cursor === '\'') {
          state = STATE_SCRIPT_SINGLEQUOTE;
        } else if (cursor === '"') {
          state = STATE_SCRIPT_DOUBLEQUOTE;
        } else if (cursor === '`') {
          state = STATE_SCRIPT_BACKQUOTE;
        }
        break;
      case STATE_SCRIPT_SINGLEQUOTE:
        token.push(cursor);
        if (cursor === '\\') {
          state = STATE_SCRIPT_SINGLEQUOTE_ESCAPE;
        } else if (cursor === '\'') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_SINGLEQUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_SINGLEQUOTE;
        break;
      case STATE_SCRIPT_DOUBLEQUOTE:
        token.push(cursor);
        if (cursor === '\\') {
          state = STATE_SCRIPT_DOUBLEQUOTE_ESCAPE;
        } else if (cursor === '"') {
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
        if (cursor === '\\') {
          state = STATE_SCRIPT_BACKQUOTE_ESCAPE;
        } else if (cursor === '`') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_BACKQUOTE_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_BACKQUOTE;
        break;
      case STATE_SCRIPT_FORWARD_SLASH:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_SCRIPT_SINGLE_LINE_COMMENT;
        } else if (cursor === '*') {
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        } else {
          // TODO: Either a division symbol, or start of regular expression
          // literal, or malformed. Ambiguous.

          if (token.length === 2) {
            // Token length is the full text of the javascript after the
            // script tag.
            // If token length is 2, and we know the previous character was
            // a /, then this means / was the first character of the text.
            // This means it cannot be division, because a division symbol
            // requires a left-hand-side operand.
            // Technically also true for whitespace but not dealing with that
            // for now.
            // So we know for sure we are in regex.
            state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL;
          } else {
            // Skip past this char, the preceding slash, and 1 because arrays
            // are 0 based. We know we can go back 3 because token length must
            // be now 3 or greater

            // NOTE: this was left in an incomplete state. Not quite sure
            // what to do or whether to proceed.

            // const CHARS_CANNOT_PRECEDE_DIVISION = '(,=:[!&|?{};';

            const b3 = token[token.length - 3];
            if (b3 === '(' || b3 === ',' || b3 === '=' || b3 === ':' ||
                b3 === '[' || b3 === '!' || b3 === '&' || b3 === '') {
              console.log('b3 is %s which means must be regex', b3);
              state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
            }
          }

          console.warn('Assuming start of regex literal at character');
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH;
        } else {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH:
        // Was in script text and encountered </
        // This could be:
        // The start of and end tag
        // Whitespace preceding a variable name or value
        // The start of an variable name or value
        // Parens
        // unicode
        // a second < in bitshift case
        // Something malformed (javascript syntax error)

        if (cursor === '/') {
          // <//
          token.push(cursor);
          state = STATE_SCRIPT_SINGLE_LINE_COMMENT;
        } else if (cursor === '*') {
          // </*
          token.push(cursor);
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        } else if (cursor === 's' || cursor === 'S') {
          // </s
          // TODO: actually this could be a regular expression literal...?
          // so we have to go all the way to </script>
          // </script [justkidding]$/i.test("uhoh") ? 0:0 ....
          token.push(cursor);
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_S;
        } else {
          // Either a division symbol, regexp, or malformed syntax
          // TODO: do I need to branch into regexp here? ambiguous
          token.push(cursor);
          state = STATE_SCRIPT_TEXT;
        }

        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_S:
        token.push(cursor);
        if (cursor === 'c' || cursor === 'C') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SC;
        } else {
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SC:
        token.push(cursor);
        if (cursor === 'r' || cursor === 'R') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCR;
        } else {
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCR:
        token.push(cursor);
        if (cursor === 'i' || cursor === 'I') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRI;
        } else {
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRI:
        token.push(cursor);
        if (cursor === 'p' || cursor === 'P') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIP;
        } else {
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIP:
        token.push(cursor);
        if (cursor === 't' || cursor === 'T') {
          state = STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIPT;
        } else {
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_LESS_THAN_SIGN_FOWARD_SLASH_SCRIPT:

        token.push(cursor);
        if (cursor === '>') {
          // TODO: if i allow whitespace after tag name in closing tag, then
          // this logic is not correct

          const scriptCloseTagLength = '</script>'.length;

          if (token.length > scriptCloseTagLength) {
            const scriptText = token.slice(0, -1 * scriptCloseTagLength);
            tokens.push(scriptText.join(''));
          }

          const closeTagText = token.slice(-1 * scriptCloseTagLength);
          tokens.push(closeTagText.join(''));
          token.length = 0;
          state = STATE_TEXT;
        } else if (/\s/.test(cursor)) {
          // TODO: actually this might not work because again the SCRIPT_TEXT
          // is a part of the token along with the closing tag
          state = STATE_TAG_CLOSE;
        } else {
          // This was not a closing script tag, it was a part of a
          // partially-scanned regular expression literal or
          // malformed syntax
          state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        }
        break;
      case STATE_SCRIPT_SINGLE_LINE_COMMENT:
        token.push(cursor);
        if (cursor === '\n') {
          state = STATE_SCRIPT_TEXT;
        }
        break;
      case STATE_SCRIPT_MULTILINE_COMMENT:
        token.push(cursor);
        if (cursor === '*') {
          state = STATE_SCRIPT_MULTILINE_COMMENT_CLOSING;
        }
        break;
      case STATE_SCRIPT_MULTILINE_COMMENT_CLOSING:
        token.push(cursor);
        if (cursor === '/') {
          state = STATE_SCRIPT_TEXT;
        } else if (cursor === '*') {
          // **
          // Stay in the same state. The first star is not closing,
          // but the second could be
        } else {
          // Encountered a * following by an unknown character, revert back to
          // comment state, this * was not a closing star.
          state = STATE_SCRIPT_MULTILINE_COMMENT;
        }
        break;
      case STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL:
        token.push(cursor);
        if (cursor === '\\') {
          state = STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE;
        } else if (cursor === '\n' || cursor === '\r') {
          // Regular expression literals cannot contain new lines according
          // to https://github.com/lydell/js-tokens
          // Therefore this must not be a regular expression literal, or is
          // a malformed regular expression literal.
          // Assume the leading slash was a division symbol and consider
          // ourselves to simply have progressed through more js text
          // TODO: but what if we entered into a string literal
          state = STATE_SCRIPT_TEXT;

        } else if (cursor === '/') {
          state = STATE_SCRIPT_TEXT;
        } else {
          // Stay in this state
        }
        break;
      case STATE_SCRIPT_REGULAR_EXPRESS_LITERAL_ESCAPE:
        token.push(cursor);
        state = STATE_SCRIPT_POSSIBLE_REGULAR_EXPRESS_LITERAL;
        break;
      default:
        // TODO: this should be an assertion error because this should never
        // happen
        throw new Error('Unknown state: ' + state);
    }  // end switch statement
  }    // end for loop

  // Handle the final token
  if (token.length) {
    tokens.push(token.join(''));
  }

  if (state !== STATE_TEXT) {
    throw new Error(
        'Ended in invalid state ' + state + ' with token ' + token.join(''));
  }

  return tokens;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
