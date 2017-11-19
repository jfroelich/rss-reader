
import {sniffIsBinaryURL} from "/src/url/url.js";

// TODO: add data uri test

function test() {
  const input = 'http://www.cse.unsw.edu.au/~hpaik/thesis/showcases/16s2/scott_brisbane.pdf';
  const result = sniffIsBinaryURL(new URL(input));
  assert(result === true, input);
}
