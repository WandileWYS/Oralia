const collection = 'https://www.gutenberg.org/files/66923/66923-h/66923-h.htm';
const verifiedChapterLinks = new Map([
  [`${collection}#ch01`, `${collection}#ch1`],
  [`${collection}#ch02`, `${collection}#ch2`],
]);

/** Repair the two legacy seed anchors without rewriting users' stored source records. */
export function resolveStorySourceUrl(url: string) {
  return verifiedChapterLinks.get(url) ?? url;
}
