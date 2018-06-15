import {filter_publisher as f} from '/src/lib/nlp.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: test using additional parameters where other parameters are not the
// default values

async function filter_publisher_test() {
  // no delimiters found
  assert(f('Hello World') === 'Hello World');

  // starts with delim
  assert(f(' - Hello World') === ' - Hello World');

  // ends with delim
  assert(f('Hello World - ') === 'Hello World - ');

  // non-default delim
  assert(f('Hello ; World') === 'Hello ; World');

  // double delim
  assert(f('Hello - World Hello abcd - World') === 'Hello - World Hello abcd');

  // mixed double delim
  assert(f('Hello : World Hello abcd - World') === 'Hello : World Hello abcd');

  // input too short retains input
  assert(f('Hello World - Big News Org') === 'Hello World - Big News Org');

  // really short
  assert(f('a - Big News Org') === 'a - Big News Org');

  // short title long publisher
  assert(
      f('a - BigNewsOrgBigNewsOrgBigNewsOrg') ===
      'a - BigNewsOrgBigNewsOrgBigNewsOrg');

  // short title long publisher multiword
  assert(
      f('a - BBBBBBBig NNNNNNNews OOOOOOOrg') ===
      'a - BBBBBBBig NNNNNNNews OOOOOOOrg');

  // long title short publisher
  assert(
      f('AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D') ===
      'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D');

  // too many words after delim
  assert(
      f('Hello World Hello World - Too Many Words In Tail Found') ===
      'Hello World Hello World - Too Many Words In Tail Found');

  // basic positive case
  assert(
      f('Hello World Hello World - Big News Org') ===
      'Hello World Hello World');
}

register_test(filter_publisher_test);
