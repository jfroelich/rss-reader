import * as array_utils from '/src/lib/array-utils.js';
import {assert} from '/src/lib/assert.js';

export async function unique_test() {
  let input = [0, 1, 2];
  let output = array_utils.unique(input);
  assert(output.length === 3);
  assert(output[0] === 0 && output[1] === 1 && output[2] === 2);

  input = [];
  output = array_utils.unique(input);
  assert(output.length === 0);

  input = [0, 0];
  output = array_utils.unique(input);
  assert(output.length === 1);

  input = [0, 1, 1];
  output = array_utils.unique(input);
  assert(output.length === 2);
  assert(output[0] === 0 && output[1] === 1);
}

export async function unique_compute_test() {
  let input = [0, 1];
  let output = array_utils.unique_compute(input, value => {
    return value + 1;
  });
  assert(output.length === 2 && output[0] === 0 && output[1] === 1);

  input = [0, 1, 2, 2, 2, 3, 4, 4, 5, 6, 7, 8, 9, 1001];
  output = array_utils.unique_compute(input, value => {
    return (value % 2) ? 0 : value;
  });
  assert(output.length === 5);
  assert(output[0] === 0);
  assert(output[1] === 2);
  assert(output[2] === 4);
  assert(output[3] === 6);
  assert(output[4] === 8);
}
