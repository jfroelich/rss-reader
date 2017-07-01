// See license.md

'use strict';

// TODO: script tag, js regex, js comments, style quoted value
// js escaped quotes
// TODO: disallow attributes in closing tags
// TODO: cdata?

// Tokenizes an arbitrary string of html. Semi-strict.
// Returns a string array of elements and text nodes.
// Style tags are grouped with style text content as a single item
// Throws an error if does not end in default state, such as in midst of tag
// Entries are left as is, no encoding/decoding is performed.
function parseHTML(inputString) {

  const tokenArray = [];
  const inputStringLength = inputString.length;

  const STATE_TAG = 1;
  const STATE_TEXT = 2;
  const STATE_COMMENT = 3;
  const STATE_TAG_SQATTRIBUTE = 4;
  const STATE_TAG_DQATTRIBUTE = 5;
  const STATE_INSTRUCTION = 6;
  const STATE_INSTRUCTION_SQATTRIBUTE = 7;
  const STATE_INSTRUCTION_DQATTRIBUTE = 8;
  const STATE_STYLE_TEXT = 9;
  const STATE_STYLE_MULTILINE_COMMENT = 10;

  // state keeps track of the current state of the lexer as it moves along
  // the characters of the input. The initial state is text.
  let state = STATE_TEXT;

  // Stores an array of single-character strings that represent the contents
  // of the token currently being built in the current state.
  let token = [];

  // Walk the input one character at a time and switch between states.
  for(let i = 0; i < inputStringLength; i++) {
    const cursor = inputString.charAt(i);

    if(state === STATE_TEXT) {

      if(cursor === '<') {

        // End of text, start of tag
        if(token.length) {
          tokenArray.push(token.join(''));
          token.length = 0;
        }

        // Start tag state
        state = STATE_TAG;
        token.push(cursor);
      } else {
        // Another character in text
        // Stay in current state
        token.push(cursor);
      }
    } else if(state === STATE_TAG) {

      if(cursor === '"') {

        // Start of double quoted attribute state
        state = STATE_TAG_DQATTRIBUTE;
        token.push(cursor);
      } else if(cursor === "'") {
        // Start of single quoted attribute state
        state = STATE_TAG_SQATTRIBUTE;
        token.push(cursor);
      } else if(cursor === '>') {
        // End of tag state, switch to either style text or text

        if(token.length > 5 &&
          token.join('').toLowerCase().startsWith('<style')) {

          // BUG: the above condition is true a second time when we reach
          // </style>, because it just checks the start of the string, which
          // means we start the style state again even though we shouldn't

          console.log('ENTERED STYLE TXT STATE');

          state = STATE_STYLE_TEXT;

          // Keep style text along with the style tag token
          token.push(cursor);

        } else {
          token.push(cursor);
          tokenArray.push(token.join(''));
          token.length = 0;
          state = STATE_TEXT;
        }

      } else if(token.length === 2 && token[1] === '?') {

        // Switch from tag state to processing instruction state
        state = STATE_INSTRUCTION;
        token.push(cursor);

      } else if(token.length === 4 && token[1] === '!' && token[2] === '-' &&
        token[3] === '-') {

        // Switch from tag state to comment state
        state = STATE_COMMENT;
        token.push(cursor);

      } else {
        // Stay in tag state
        token.push(cursor);
      }
    } else if(state === STATE_COMMENT) {
      // <!----> is 7 characters in shortest possible comment, so > 6 is
      // earliest check for end of comment.
      const offset = token.length - 1;
      if(token.length > 6 && token[offset] === '>' && token[offset-1] === '-' &&
        token[offset-2] === '-') {

        // End of comment
        token.push(cursor); // Append >
        tokenArray.push(token.join('')); // Add comment as token
        token.length = 0; // Reset token
        state = STATE_TEXT; // Switch back to text state
      } else {
        // Stay in comment state
        token.push(cursor);
      }
    } else if(state === STATE_TAG_SQATTRIBUTE) {

      if(cursor === "'") {
        token.push(cursor);
        // Switch from single quoted attribute state to tag state
        state = STATE_TAG;
      } else {
        // Stay in single quoted attribute state
        token.push(cursor);
      }

    } else if(state === STATE_TAG_DQATTRIBUTE) {

      if(cursor === '"') {
        token.push(cursor);
        // Switch from double quoted attribute state to tag state
        state = STATE_TAG;
      } else {
        // Stay in double quoted attribute state
        token.push(cursor);
      }

    } else if(state === STATE_INSTRUCTION) {

      if(cursor === '"') {
        token.push(cursor);
        state = STATE_INSTRUCTION_DQATTRIBUTE;
      } else if(cursor === "'") {
        token.push(cursor);
        state = STATE_INSTRUCTION_SQATTRIBUTE;
      } else if(cursor === '>' && token[token.length - 1] === '?') {

        // End of instruction state, and also end of tag state
        // Switch to text state
        token.push(cursor);
        tokenArray.push(token.join(''));
        token.length = 0;

      } else {
        // Stay in current state
        token.push(cursor);
      }

    } else if(state === STATE_INSTRUCTION_SQATTRIBUTE) {

      if(cursor === "'") {
        token.push(cursor);
        state = STATE_INSTRUCTION;
      } else {
        token.push(cursor);
      }
    } else if(state === STATE_INSTRUCTION_DQATTRIBUTE) {

      if(cursor === '"') {
        token.push(cursor);
        state = STATE_INSTRUCTION;
      } else {
        token.push(cursor);
      }
    } else if(state === STATE_STYLE_TEXT) {

      if(cursor === '*' && token.length > 1 && token[token.length -1] === '/') {
        state = STATE_STYLE_MULTILINE_COMMENT;
        token.push(cursor);
      } else if(cursor === '<') {

        console.log('ENDED STYLE TEXT STATE');

        // End of style text
        // Keep the style text with the whole style tag token
        token.push(cursor);
        state = STATE_TAG;
      } else {
        // Stay in style text state
        token.push(cursor);
      }

    } else if(state === STATE_STYLE_MULTILINE_COMMENT) {

      if(cursor === '/' && token[token.length - 1] === '*') {
        // End of style comment
        token.push(cursor);
        // Switch back to style text state
        state = STATE_STYLE_TEXT;
      } else {
        // Stay in style comment state
        token.push(cursor);
      }

    } else {
      throw new Error('Unknown state: ' + state);
    }
  }

  // Handle the final token
  if(token.length) {
    tokenArray.push(token.join(''));
  }

  if(state !== STATE_TEXT) {
    throw new Error('Ended in invalid state: ' + state + ' ' + token.join(''));
  }

  return tokenArray;
}
