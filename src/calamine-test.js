// Testing calamine


function testCalamine(url) {
  var each = Array.prototype.forEach;
  var r = new XMLHttpRequest();
  r.onload = onGet;
  r.open('GET', url, true);
  r.responseType='document';
  r.send();

  function onGet() {
    var doc = r.responseXML;

    if(!doc.body) {
      console.warn('nobody');
      return;
    }

    var imgs = doc.body.getElementsByTagName('img');
    if(!imgs.length) {
      onImageDimensionsSet(doc);
    }

    each.call(imgs, resolveImageSource.bind(null, r.responseURL));
    each.call(imgs, setImageDimensions.bind({
      count: imgs.length,
      processed: 0,
      onComplete: onImageDimensionsSet.bind(null, doc)
    }));
  }

  function onImageDimensionsSet(doc) {
    lucu.removeComments(doc);
    lucu.removeBlacklistedElements(doc);
    lucu.removeUnknownElements(doc);
    lucu.removeTracerImages(doc);
    lucu.unwrwapNoscripts(doc);
    lucu.unwrapNoframes(doc);
    lucu.canonicalizeSpaces(doc);
    lucu.trimNodes(doc);
    lucu.removeEmptyNodes(doc);
    lucu.removeEmptyElements(doc);
    var results = calamine.transform(doc, {
      SHOW_CHAR_COUNT: 1,
      SHOW_SCORE: 1,
      IMAGE_BRANCH: 1
    });

    // lucu.removeDescendantAttributes(lucu.DEFAULT_ALLOWED_ATTRIBUTES , doc.body);
    lucu.trimElement(results);

    results.setAttribute('best', 'best');
    //document.body.appendChild(results);

    document.body.fontSize = '12pt';
    while(document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.appendChild(doc.body);
  }

  function setImageDimensions(img) {

    if(!img.src) {

      // This actually happens. See
      // http://www.lakewyliepilot.com/2014/09/12/2586742/police-escaped-school-shooter.html?sp=/99/506/
      // as an example. It is actually more likely give that I strip scripts that
      // may have referenced hardcoded html <img> tags as templates

      if(++this.processed == this.count) {
        this.onComplete();
      }
      return;
    }


    if(img.width) {
      if(++this.processed == this.count) {
        this.onComplete();
      }
      return;
    }

    var local = document.importNode(img, false);
    local.onerror = console.debug;

    var self = this;
    local.onload = function() {
      img.width = local.width;
      img.height = local.height;
      if(++self.processed == self.count) {
        self.onComplete();
      }
    };

    var t = local.src;
    local.src = void t;
    local.src = t;
  }

  function resolveImageSource(base, img) {
    var url = img.getAttribute('src');
    if(!url) return;
    if(/^\*sdata:/i.test(url)) return;
    var abs = URI(url).absoluteTo(base).toString();
    if(abs != url) {
      img.setAttribute('src', abs);
    }

    //console.log('resolved %s', abs);
  }
}