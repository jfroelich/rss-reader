import * as utils from '/src/core/utils.js';
import {assert} from '/src/lib/assert.js';

export async function replace_tags_test() {
  // TODO: implement me
}

// TODO: store input-ouput pairs then simply iterate
// TODO: store input/output in a json file, then change this test to load the
// local json file data and run against that, instead of hardcoding?
// TODO: test various failure cases, e.g. bad inputs
// TODO: more tests, e.g. short title
export async function article_title_test() {
  // no delimiters found
  assert(utils.filter_publisher('Hello World') === 'Hello World');
  // starts with delim
  assert(utils.filter_publisher(' - Hello World') === ' - Hello World');
  // ends with delim
  assert(utils.filter_publisher('Hello World - ') === 'Hello World - ');
  // non-default delim
  assert(utils.filter_publisher('Hello ; World') === 'Hello ; World');
  // double delim
  assert(
      utils.filter_publisher('Hello - World Hello abcd - World') ===
      'Hello - World Hello abcd');
  // mixed double delim
  assert(
      utils.filter_publisher('Hello : World Hello abcd - World') ===
      'Hello : World Hello abcd');
  // input too short retains input
  assert(
      utils.filter_publisher('Hello World - Big News Org') ===
      'Hello World - Big News Org');
  // really short
  assert(utils.filter_publisher('a - Big News Org') === 'a - Big News Org');
  // short title long publisher
  assert(
      utils.filter_publisher('a - BigNewsOrgBigNewsOrgBigNewsOrg') ===
      'a - BigNewsOrgBigNewsOrgBigNewsOrg');
  // short title long publisher multiword
  assert(
      utils.filter_publisher('a - BBBBBBBig NNNNNNNews OOOOOOOrg') ===
      'a - BBBBBBBig NNNNNNNews OOOOOOOrg');
  // long title short publisher
  assert(
      utils.filter_publisher('AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D') ===
      'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCCCCCCCC - D');
  // too many words after delim
  assert(
      utils.filter_publisher(
          'Hello World Hello World - Too Many Words In Tail Found') ===
      'Hello World Hello World - Too Many Words In Tail Found');
  // basic positive case
  assert(
      utils.filter_publisher('Hello World Hello World - Big News Org') ===
      'Hello World Hello World');
}


export async function truncate_html_test() {
  const truncate_html = utils.truncate_html;
  const e = '.';
  let input = 'a<p>b</p>c';
  let output = 'a<p>b.</p>';
  assert(truncate_html(input, 2, e) === output);

  // TODO: finish transition from old tests to new tests here

  /*
  const input2 = `<html><head><title>new title</title></head><body>${input1}
    </body></html>`;
  assert(input2, '=>', truncate_html(input2, 2, ext));
  const input3 = `<html><head><title>new title</title></head><body>
    <span style="display:none">hidden</span>${input1}</body></html>`;
  assert(input3, '=>', truncate_html(input3, 2, ext));
  const input4 = 'abc';
  assert(input4, '=>', truncate_html(input4, 2, ext));
  const input5 = 'a&nbsp;bc';
  assert(input5, '=>', truncate_html(input5, 2, ext));
  const input6 = 'a&nbsp;b&amp;c&lt;d';
  assert(input6, '=>', truncate_html(input6, 2, ext));
  const input7 = 'a&#32;b';
  assert(input7, '=>', truncate_html(input7, 2, ext));
  */
}
