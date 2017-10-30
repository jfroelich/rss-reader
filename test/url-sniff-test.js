
// import net/url.js

function test() {
  const input = 'http://www.cse.unsw.edu.au/~hpaik/thesis/showcases/16s2/scott_brisbane.pdf';
  const result = url_sniff_is_binary(new URL(input));
  console.assert(result === true, 'failed:', input);
}
