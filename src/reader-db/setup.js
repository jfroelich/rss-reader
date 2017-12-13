import FeedStore from "/src/feed-store/feed-store.js";

// Create the reader-db database
export default async function main() {
  const fs = new FeedStore();
  try {
    await fs.open();
  } finally {
    fs.close();
  }
}
