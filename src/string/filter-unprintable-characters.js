
// TODO: eventually move to utils
// TODO: look into how much this overlaps with filterControls
// TODO: would + qualifer improve speed, decrease speed, or have no effect, or no material effect
// on performance?

// \t is \u0009 which is base10 9
// \n is \u000a which is base10 10
// \f is \u000c which is base10 12
// \r is \u000d which is base10 13

const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]/g;

export default function main(value) {
  return typeof value === 'string' && value.length ? value.replace(pattern, '') : value;
}
