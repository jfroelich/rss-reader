const button = document.getElementById('toggle');
button.onclick = toggleButtonOnclick;

const left = document.getElementById('left');

function toggleButtonOnclick(event) {
  if (left.style.marginLeft === '0px' || left.style.marginLeft === '') {
    left.style.marginLeft = '-200px';
  } else {
    left.style.marginLeft = '0px';
  }
}
