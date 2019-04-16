import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import filterPublisher from '/lib/filter-publisher.js';

function filterPublisherTest() {
  const pairs = [];

  // normal use
  pairs.push({
    input: 'Hello World Hello World - Big News Org',
    output: 'Hello World Hello World'
  });

  // title without delimiter
  pairs.push({ input: 'Hello World', output: 'Hello World' });
  // starting with delimiter
  pairs.push({ input: ' - Hello World', output: ' - Hello World' });
  // ending with delimiter
  pairs.push({ input: 'Hello World - ', output: 'Hello World - ' });
  // non-default delimiter
  pairs.push({ input: 'Hello ; World', output: 'Hello ; World' });
  // double delimiter
  pairs.push({
    input: 'Hello - World Hello abcd - World',
    output: 'Hello - World Hello abcd'
  });
  // mixed double delimiter
  pairs.push({
    input: 'Hello : World Hello abcd - World',
    output: 'Hello : World Hello abcd'
  });
  // short title
  pairs.push({
    input: 'Hello World - Big News Org',
    output: 'Hello World - Big News Org'
  });
  // even shorter title
  pairs.push({ input: 'a - Big News Org', output: 'a - Big News Org' });

  // short title long publisher
  pairs.push({
    input: 'a - BigNewsOrgBigNewsOrgBigNewsOrg',
    output: 'a - BigNewsOrgBigNewsOrgBigNewsOrg'
  });

  // short title long publisher multiword
  pairs.push({
    input: 'a - BBBBBBBig NNNNNNNews OOOOOOOrg',
    output: 'a - BBBBBBBig NNNNNNNews OOOOOOOrg'
  });

  // long title short publisher
  pairs.push({
    input: 'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D',
    output: 'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D'
  });

  // too many words after delim
  pairs.push({
    input: 'Hello World Hello World - Too Many Words In Tail Found',
    output: 'Hello World Hello World - Too Many Words In Tail Found'
  });

  for (const { input, output } of pairs) {
    assert(filterPublisher(input) === output);
  }
}

TestRegistry.registerTest(filterPublisherTest);
