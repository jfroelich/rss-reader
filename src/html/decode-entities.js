
// TODO: i'd eventually like to not involve the dom but for now 

// https://stackoverflow.com/questions/1912501
export default function decodeEntities(value) {
  var el = document.createElement('div');
  return value.replace(/\&[#0-9A-Za-z]+;/g, function (enc) {
      el.innerHTML = enc;
      return el.innerText
  });
}
