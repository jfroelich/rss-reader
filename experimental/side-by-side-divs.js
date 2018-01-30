
// TODO: zoom in and out the left menu side

const button = document.getElementById('toggle');
button.onclick = toggleButtonOnclick;

const left = document.getElementById('left');

function toggleButtonOnclick(event) {
  /*  console.debug('flexBasis', leftPanel.style.flexBasis, typeof
    leftPanel.style.flexBasis); if(leftPanel.style.flexBasis === '200px' ||
    leftPanel.style.flexBasis === '') { console.debug('=== 200px so changing to
    0px'); leftPanel.style.flexBasis = '0px'; } else { console.debug('!== 200px
    so changing to 200px'); leftPanel.style.flexBasis = '200px';
    }*/

  if (left.style.marginLeft === '0px' || left.style.marginLeft === '') {
    left.style.marginLeft = '-200px';
  } else {
    left.style.marginLeft = '0px';
  }
}
