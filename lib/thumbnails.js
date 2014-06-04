

var thumbnails = {};
thumbnails.request = function(url,oncomplete,onerror,timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = function(event) {
    if(this.status != 200) {
      onerror('status ' + this.status);
      return;
    }
    oncomplete(this.response);
  };

  request.open('GET',url, true);
  request.send();  
};


// Miniature version of sanitize.
// Using callback because of plan to support 
// async expansion of nested resources
thumbnails.sanitize = function(doc, baseURL, callback) {
  var baseURI = URI.parse(baseURL);

  // Fix inline javascript:
  util.toArray($$('a', doc)).forEach(function(anchor) {
    // We don't care about the value of href, just 
    // its presence. This gets rid of javascript: 
    // as well.
    if(anchor.hasAttribute('href')) {
      anchor.setAttribute('href','#');
    }
  });

  // Resolve relative image src attribute urls and 
  // pause animated images.
  util.toArray($$('img',doc)).forEach(function(image) {
    var source = image.getAttribute('src');
    if(baseURI && source) {
      // Resolve relative image sources
      var relativeURI = URI.parse(source);

      if(relativeURI.scheme != 'data') {
        var absoluteURL = URI.resolve(baseURI, relativeURI);
        //console.log('%s %s', source, absoluteURL);
        image.setAttribute('src', absoluteURL);        
      }
    }

    // To stop animated gifs we have to use the canvas technique
    // Note: going to have problems with width and height if the image 
    // has not loaded. So in order to do this we have to send sep 
    // ajax requests.
    
    //http://stackoverflow.com/questions/3688460/stopping-gif-animation-programmatically
    //https://raw.githubusercontent.com/chrisantonellis/freezeframe/master/freezeframe.js
/*
[].slice.apply(document.images).filter(is_gif_image).map(freeze_gif);

function is_gif_image(i) {
    return /^(?!data:).*\.gif/i.test(i.src);
}

function freeze_gif(i) {
    var c = document.createElement('canvas');
    var w = c.width = i.width;
    var h = c.height = i.height;
    c.getContext('2d').drawImage(i, 0, 0, w, h);
    try {
        i.src = c.toDataURL("image/gif"); // if possible, retain all css aspects
    } catch(e) { // cross-domain -- mimic original with all its tag attributes
        for (var j = 0, a; a = i.attributes[j]; j++)
            c.setAttribute(a.name, a.value);
        i.parentNode.replaceChild(c, i);
    }
}


// https://raw.githubusercontent.com/chrisantonellis/freezeframe/master/freezeframe.js
// Using imagesLoaded by Desandro because .load doesn't work on cached images
    $(this).imagesLoaded(function() {

        $(this).off("imagesLoaded");

        _ff.canvas[0].width = $(this)[0].clientWidth;
        _ff.canvas[0].height = $(this)[0].clientHeight;

        $(this).attr("animated", $(this).attr("src"))
            .attr("src", $(this).attr("src"));

        _ff.context.drawImage(_self, 0, 0, $(this)[0].clientWidth, $(this)[0].clientHeight);

        $(this).attr("src", _ff.canvas[0].toDataURL());

*/
    
  });

  
  if(baseURI) {
    var links = $$('link[rel="stylesheet"]',doc);
    util.toArray(links).forEach(function(link) {
      var href = link.getAttribute('href');
      if(href) {
        var relativeURI = URI.parse(href);
        var absoluteURL = URI.resolve(baseURI, relativeURI);
        link.setAttribute('href', absoluteURL);
      }
    });
  }

  //style.webkitAnimationPlayState = 'paused';
  
  // TODO: stop animated images from animating.

  // todo: for all style rules anywhere i need to resolve relative urls. 
  // this is why bing.com background does not show up.
  // maybe the trick is to append a base tag?

  // TODO: convert images to data urls?
  // TODO: intelligent resize images? (lachos or whatever, css transform?)
  // TODO: fetch all stylesheets and replace with style elements?
  // TODO: instead of removing video, get its first frame as an image?
  util.toArray($$('audio,applet,blink,embed,frame,frameset,object,script,video',
    doc)).forEach(function(element) {
    if(element && element.parentNode) {
      element.parentNode.removeChild(element);  
    }
  });

  // TODO: unpack iframe content into parents
  util.toArray(doc.querySelectorAll('iframe')).forEach(function(element) {
    if(element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  var atts = {'http-equiv':1,'class':1,colspan:1,content:1,id:1,width:1,height:1,
    style:1,border:1,href:1,rel:1,src:1,type:1,align:1,valign:1};
  util.toArray(doc.querySelectorAll('*')).forEach(function(element) {

    // Stop CSS3 animations on all elements
    // TODO: apply this to only certain elements, not every single one
    //element.style.animationPlayState = 'paused';
    //element.style.webkitAnimationPlayState = 'paused';

    util.toArray(element.attributes).forEach(function(attr) {
      if(!atts[attr.name]) {
        //console.log('Removing <%s %s="%s">', element.localName, attr.name, attr.value);
        element.removeAttribute(attr.name);
      } else {
        //console.log('Allowing <%s %s="%s">', element.localName, attr.name, attr.value);
      }
    });
  });

  callback(doc);
};

thumbnails.appendChild = function(parent, url) {
  if(!parent || !url) return;

  var onsanitize = function(doc) {
    var f = document.createElement('iframe');
    f.style.overflow = 'none';
    f.setAttribute('scrolling','no');
    f.style.webkitUserSelect = 'none'
    f.style.userSelect = 'none';
    f.style.pointerEvents = 'none';
    //f.style.border = 'none';
    f.style.border = '1px dotted #cccccc';
    //f.width = 250;
    parent.appendChild(f);
    var htmlElement = f.contentWindow.document.documentElement;
    htmlElement.innerHTML = doc.innerHTML;
    htmlElement.style.webkitTransformOrigin = '0 0';
    htmlElement.style.webkitTransform = 'scale('+( (300+30)/(screen.width-60)).toFixed(3)+')';
  };

  var onfetch = function(responseText) {
    var doc = util.parseHTML(responseText);
    thumbnails.sanitize(doc, url, onsanitize);
  };

  var onerror = function(e) {
    console.log(e);
  };
  
  thumbnails.request(url, onfetch, onerror, 3000);
};

// We want to cache the requests so that it works 
// offline so we need our own cache management?
// Like a "thumbs" cache that determines when and 
// if to update.

// We have thumbnails per feed link and per 
// article link. So the general solution is to use a 
// property in each store, instead of a 
// separate store. But iteration over the stores 
// means the whole thing is in mem. Maybe use 
// filesystem instead and use links to file system?
// This is the same issue with CLOBs. But maybe 
// Chrome has intelligent blob management, would need to 
// research.