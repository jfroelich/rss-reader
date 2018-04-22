import {filter_publisher as f} from '/src/lib/filter-publisher.js';

// no delimiters found
console.assert(f('Hello World') === 'Hello World');

// starts with delim
console.assert(f(' - Hello World') === ' - Hello World');

// ends with delim
console.assert(f('Hello World - ') === 'Hello World - ');

// non-default delim
console.assert(f('Hello ; World') === 'Hello ; World');

// double delim
console.assert(
    f('Hello - World Hello abcd - World') === 'Hello - World Hello abcd');

// mixed double delim
console.assert(
    f('Hello : World Hello abcd - World') === 'Hello : World Hello abcd');

// input too short retains input
console.assert(
    f('Hello World - Big News Org') === 'Hello World - Big News Org');

// really short
console.assert(f('a - Big News Org') === 'a - Big News Org');

// short title long publisher
console.assert(
    f('a - BigNewsOrgBigNewsOrgBigNewsOrg') ===
    'a - BigNewsOrgBigNewsOrgBigNewsOrg');

// short title long publisher multiword
console.assert(
    f('a - BBBBBBBig NNNNNNNews OOOOOOOrg') ===
    'a - BBBBBBBig NNNNNNNews OOOOOOOrg');

// long title short publisher
console.assert(
    f('AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D') ===
    'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D');

// too many words after delim
console.assert(
    f('Hello World Hello World - Too Many Words In Tail Found') ===
    'Hello World Hello World - Too Many Words In Tail Found');

// basic positive case
console.assert(
    f('Hello World Hello World - Big News Org') === 'Hello World Hello World');

console.log('Tests complete (if no error messages before then all passed)');
