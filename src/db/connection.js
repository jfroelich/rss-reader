// Represents a connection to the database
export default function Connection() {
  this.conn = undefined;
  this.channel = undefined;
}

Connection.prototype.close = function () {
  this.conn.close();

  // Treat channel as optional
  if (this.channel) {
    this.channel.close();
  }
};
