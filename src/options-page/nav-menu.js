export default function NavMenu() {
  this.onclick = undefined;
  this.currentItem = undefined;
}

// TODO: use single listener on the menu itself
NavMenu.prototype.init = function navMenuInit() {
  const menuItems = document.querySelectorAll('#navigation-menu li');
  for (const item of menuItems) {
    item.onclick = this.itemOnclick.bind(this);
  }
};

// The listener is attached to the item, but that may not be what triggered
// the click event of event.target, so use currentTarget to get the element
// where the listener is attached
NavMenu.prototype.itemOnclick = function navMenuItemOnclick(event) {
  this.onclick(event.currentTarget);
};
