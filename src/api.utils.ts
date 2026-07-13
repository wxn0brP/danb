import { AnotherCache } from "@wxn0brp/ac";
import { flag, Flags } from "./flags";
import { logs, PAGE_LIMIT, SERVER_URL } from "./vars";

export interface Post {
    id: number;
    tag_string: string;
}

const cache = new AnotherCache<Post[]>();
cache.options.ttl = 10 * 60 * 1000; // 10 minutes

export async function fetchApiPage(apiPage: number, tags: string[]): Promise<Post[]> {
    const cacheKey = `${apiPage}:${tags.join("|")}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams({
        tags: tags.join(" "),
        page: apiPage.toString(),
        limit: PAGE_LIMIT.toString(),
    });

    const url = `${SERVER_URL}/posts.json?${query}`;
    if (flag(logs, Flags.POSTS_DEBUG))
        console.log(`[A] Fetching API page ${apiPage} for: ${tags}`);

    const start = Date.now();
    let res: Response;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10s timeout
    } catch (err) {
        if (err.name === "AbortError") {
            console.warn(`[A] Timeout fetching page ${apiPage}, skipping...`);
            return []
        }
        throw err;
    }
    const end = Date.now();
    if (flag(logs, Flags.POSTS_DEBUG)) {
        console.log(`[A] Fetch took ${end - start}ms`);
    }

    if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
            if (flag(logs, Flags.POSTS_DEBUG)) {
                console.warn(`[A] Page ${apiPage} blocked (auth/premium), skipping...`);
            }
            return [];
        }
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    let posts: Post[];
    try {
        posts = await res.json();
    } catch (err) {
        console.warn(`[A] JSON parse error on page ${apiPage}, skipping...`);
        cache.set(cacheKey, [], 60_000);
        return [];
    }

    if (!Array.isArray(posts)) {
        console.warn(`[A] Invalid response format on page ${apiPage}`);
        cache.set(cacheKey, [], 60_000);
        return [];
    }

    cache.set(cacheKey, posts);
    return posts;
}
