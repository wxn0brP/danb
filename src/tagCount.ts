import { AnotherCache } from "@wxn0brp/ac";
import { SERVER_URL } from "./vars";

const cache = new AnotherCache<number>();
cache._ttl = 60 * 60 * 1000;

/**
 * Fetch post_count for a tag from API.
 */
async function getTagPostCount(tagName: string): Promise<number> {
    const cached = cache.get(tagName.toLowerCase());
    if (cached !== undefined) return cached;

    try {
        const url = `${SERVER_URL}/tags.json?search[name]=${encodeURIComponent(tagName)}`;
        const data = await fetch(url).then(res => res.json());
        const count = data[0]?.post_count || 0;
        cache.set(tagName.toLowerCase(), count);
        return count;
    } catch {
        return 0;
    }
}

/**
 * Sort tags with "order:xxx" always first, rest sorted by post_count ascending.
 */
export async function sortTags(tags: string[]): Promise<string[]> {
    const orderTags: string[] = [];
    const otherTags: Array<{ tag: string; count: number }> = [];

    for (const tag of tags) {
        const trimmed = tag.trim();
        if (trimmed.toLowerCase().startsWith("order:")) {
            orderTags.push(trimmed);
        } else {
            const count = await getTagPostCount(trimmed);
            otherTags.push({ tag: trimmed, count });
        }
    }

    otherTags.sort((a, b) => a.count - b.count);
    return [...orderTags, ...otherTags.map(t => t.tag)];
}
