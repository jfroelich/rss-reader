
function testCalamine(url) {
  var each = Array.prototype.forEach;
  var r = new XMLHttpRequest();
  r.onload = function () {

    var doc = r.responseXML;

    if(!doc.body) {
      console.warn('no body');
      return;
    }

    applyCalamine(doc);

  };
  r.open('GET', url, true);
  r.responseType='document';
  r.send();

  return 'Running test';
}
