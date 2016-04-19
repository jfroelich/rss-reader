// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: i think there are so many problems with this approach that I should
// avoid it. There are several issues with complexity and security, speed,
// and scalability. I should be spending time instead on how to avoid the
// ambiguity with <html><body> instead in the old version. Also, I should at
// least use the newer entity handling approach from here. So I should go back
// to editing the original version and work on the body behavior issues.


// UNFINISHED
// NOTE: due to the simplicity of the html parsing this is unsafe and
// vulnerable to XSS.
// This is the next version of html-truncate.js. I am working on trying to
// avoid some of the issues in the first version. In particular:
// * I don't like how the first version strips out of body html.
// * I don't like how it uses an unsafe live element to work with entities
// * I don't like how it is lossy encoding. Original entities are lost when
// decoded and re-encoded. Left padded zeros, numerical or character based
// entities, nbsp to space to space, etc.

function html_truncate2(inputString, position, extensionString) {
  'use strict';

  // TODO: this still needs some refinement
  // The parentheses modify the call to split so that it includes the
  // entities in the output array
  const CAPTURING_ENTITY_PATTERN = /(&#?x?[a-z0-9]+;)/gi;

  const tokenArray = html_truncate_tokenize(inputString);
  const tokenArrayLength = tokenArray.length;

  let accumulatedLength = 0;

  let outputBuffer = [];


  let acceptingText = true;
  let decodedTextLength = 0;

  // Side note: maybe what I really just want to do is find from this the
  // adjusted position at which to truncate, instead of imperatively
  // truncating.

  let j = 0;
  let entityToken = null;
  let entityTokenArray = null;
  let entityTokenArrayLength = 0;
  let entityTokenLength = 0;
  let isEntity = false;

  for(let i = 0, token; i < tokenArrayLength; i = i + 1) {
    token = tokenArray[i];

    if(token.startsWith('<') && token.endsWith('>')) {
      // Handle tag token
      console.debug('Appending to output tag:', token);
      outputBuffer.push(token);
      accumulatedLength = accumulatedLength + token.length;
    } else {
      // Handle text token
      if(!acceptingText) {
        console.debug('Ignoring text token:', token);
        continue;
      }

      // Split into text and entity text tokens. Because the regular expression
      // captures the entities are included in the array
      entityTokenArray = token.split(CAPTURING_ENTITY_PATTERN);

      // Get the decoded length of the token, which counts entities as 1 length
      decodedTextLength = html_truncate_get_decoded_text_length(
        entityTokenArray);

      if(accumulatedLength + decodedTextLength > position) {
        // We reached the point in the total input string where we want to
        // start truncating.
        console.debug('Next text append would pass limit:', token);
        console.debug('Truncating:', entityTokenArray);

        for(j = 0; j < entityTokenArray.length; j++) {
          entityToken = entityTokenArray[j];
          isEntity = entityToken.startsWith('&') && entityToken.endsWith(';');
          entityTokenLength = isEntity ? 1 : entityToken.length;

          // This condition i think is the cause of the bug. Something is
          // off. It could just be how i take the substring?
          console.debug('( %s + %s ) > %s',
            accumulatedLength, entityTokenLength, position);
          if(accumulatedLength + entityTokenLength > position) {

            if(isEntity) {
              console.debug('Appending to output entity:', entityToken);
              outputBuffer.push(entityToken);
            } else {
              console.debug('Appending to output substring:',
                entityToken.substring(0, position - accumulatedLength));
              outputBuffer.push(entityToken.substring(0,
                position - accumulatedLength));
            }

            // end the loop, the rest of the entity tokens are not appended
            console.debug('Breaking from truncation loop');
            break;

          } else {
            console.debug('Appending to output non-entity text:', entityToken);
            console.debug('Advance accumulated length by:', entityTokenLength);
            accumulatedLength = accumulatedLength + entityTokenLength;
            outputBuffer.push(entityToken);
          }
        }

        // Transition to non-accepting state for future iterations
        console.debug('Stop accepting text');
        acceptingText = false;

      } else {
        // We are in the situation where we do not want to truncate and want
        // to continue accumulating output text.
        accumulatedLength = accumulatedLength + decodedTextLength;
        console.debug('Appending to output text under limit:', token);
        outputBuffer.push(token);
      }
    }
  }

  return outputBuffer.join('');
}

// Extremely naive and simple tag parsing.

// TODO: I probably should use a table of transitions and just do a lookup.
// TODO: look into whether I can do this with a call to split and
// a capturing regex. The regex just needs to capture tags properly, accounting
// for single and double quoted attribute values.
// NOTE: this assumes no <script> or <style> or comment tags.
// NOTE: a space after an < is treated as a less than sign, not the start of
// a tag name
// NOTE: This assumes the input string is encoded, meaning that the presence
// of < is start of tag, and the presence of &lt; is just an encoded < entity
// of a text node.
// NOTE: This assumes the inputString is a defined string.
function html_truncate_tokenize(inputString) {
  'use strict';

  const STATE_TAG = 1;
  const STATE_TEXT = 2;
  const STATE_DOUBLE_QUOTED_ATTRIBUTE = 3;
  const STATE_SINGLE_QUOTED_ATTRIBUTE = 4;

  let state = STATE_TEXT;
  const inputLength = inputString.length;
  let tokenStringBuffer = [];
  let tokenArray = [];

  for(let i = 0, char; i < inputLength; i++) {
    char = inputString.charAt(i);
    switch(state) {
      case STATE_TAG:
        tokenStringBuffer.push(char);
        if(char === '"') {
          state = STATE_DOUBLE_QUOTED_ATTRIBUTE;
        } else if(char === "'") {
          state = STATE_SINGLE_QUOTED_ATTRIBUTE;
        } else if(char === '>') {
          state = STATE_TEXT;
          tokenArray.push(tokenStringBuffer.join(''));
          tokenStringBuffer = [];
        }
        break;
      case STATE_TEXT:
        if(char === '<') {
          state = STATE_TAG;
          if(tokenStringBuffer.length) {
            tokenArray.push(tokenStringBuffer.join(''));
            tokenStringBuffer = [];
          }
        }
        tokenStringBuffer.push(char);
        break;
      case STATE_DOUBLE_QUOTED_ATTRIBUTE:
        tokenStringBuffer.push(char);
        if(char === '"') {
          state = STATE_TAG;
        }
        break;
      case STATE_SINGLE_QUOTED_ATTRIBUTE:
        tokenStringBuffer.push(char);
        if(char === "'") {
          state = STATE_TAG;
        }
        break;
      default:
        break;
    }
  }

  // Append the final buffer
  if(tokenStringBuffer.length) {
    tokenArray.push(tokenStringBuffer.join(''));
  }

  return tokenArray;
}

// Accepts an array of strings that are the results of splitting a text
// string containing encoded text (text that contains entities).
// Returns a count of the decoded length. Essentially, entities are counted as
// having only 1 length.
// TODO: the startsWith('&') is wrong, because it could match a malformed
// encoded ampersand that wasn't an entity that starts a string.
function html_truncate_get_decoded_text_length(entityTokenArray) {
  'use strict';
  const entityTokenArrayLength = entityTokenArray.length;
  let decodedLength = 0;

  for(let i = 0, token; i < entityTokenArrayLength; i++) {
    token = entityTokenArray[i];
    if(token.startsWith('&') && token.endsWith(';')) {
      decodedLength = decodedLength + 1;
    } else {
      decodedLength = decodedLength + token.length;
    }
  }
  return decodedLength;
}
