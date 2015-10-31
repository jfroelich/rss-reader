
// Testing calamine
function testCalamine(url) {
  var each = Array.prototype.forEach;
  var r = new XMLHttpRequest();
  r.onload = function () {

    var doc = r.responseXML;

    if(!doc.body) {
      console.warn('no body');
      return;
    }

    var imgs = doc.body.getElementsByTagName('img');
    if(!imgs.length) {
      return onImageDimensionsSet(doc);
    }

    each.call(imgs, function (img) {
      var url = img.getAttribute('src');
      if(!url) return;

      // NOTE: for some unknown reason
      // /^\s*data\s*:/i does not match but the following does
      if(/^data:/i.test(url)) return;

      try {
        var abs = URI(url).absoluteTo(r.responseURL).toString();
        if(abs == url) return;
        img.setAttribute('src', abs);
      } catch(e) {
        console.debug(url);
      }
    });

    /*each.call(imgs, setImageDimensions.bind({
      count: imgs.length,
      processed: 0,
      onComplete: onImageDimensionsSet.bind(null, doc)
    }));*/
  };
  r.open('GET', url, true);
  r.responseType='document';
  r.send();

  function onImageDimensionsSet(doc) {

    applyCalamine(doc);
  }

  return 'Running test';
}
