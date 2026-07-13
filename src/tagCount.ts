import { AnotherCache } from "@wxn0brp/ac";
import { SERVER_URL } from "./vars";
import { isFreeMetaTag, isLimitedMetaTag } from "./filter";

const cache = new AnotherCache<number>();
cache.options.ttl = 60 * 60 * 1000;

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

export async function sortTags(tags: string[]): Promise<string[]> {
    const freeMeta: string[] = [];
    const limitedMeta: string[] = [];
    const otherTags: Array<{ tag: string; count: number }> = [];
    const negativeTags: Array<{ tag: string; count: number }> = [];

    for (const tag of tags) {
        const trimmed = tag.trim();
        if (isFreeMetaTag(trimmed)) {
            freeMeta.push(trimmed);
        } else if (isLimitedMetaTag(trimmed)) {
            limitedMeta.push(trimmed);
        } else if (trimmed.startsWith("-")) {
            const count = await getTagPostCount(trimmed.slice(1));
            negativeTags.push({ tag: trimmed, count });
        } else {
            const count = await getTagPostCount(trimmed);
            otherTags.push({ tag: trimmed, count });
        }
    }

    otherTags.sort((a, b) => a.count - b.count);
    negativeTags.sort((a, b) => b.count - a.count);

    return [
        ...freeMeta,
        ...limitedMeta,
        ...otherTags.map(t => t.tag),
        ...negativeTags.map(t => t.tag)
    ];
}
