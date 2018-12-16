// Remove consecutive <br>s
export function breakrule_filter(document) {
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
  }
}
