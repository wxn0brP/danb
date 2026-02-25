import { flag, Flags } from "./flags";
import { logs, PAGE_LIMIT, SERVER_URL } from "./vars";

export async function fetchApiPage(apiPage: number, tags: string[]) {
    const query = new URLSearchParams({
        tags: tags.join(" "),
        page: apiPage.toString(),
        limit: PAGE_LIMIT.toString(),
    });

    const url = `${SERVER_URL}/posts.json?${query}`;
    if (flag(logs, Flags.POSTS_DEBUG)) {
        console.log(`[A] Fetching API page ${apiPage} for: ${tags}`);
    }

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

    // Handle 403/401 – no access to page (premium)
    if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
            if (flag(logs, Flags.POSTS_DEBUG)) {
                console.warn(`[A] Page ${apiPage} blocked (auth/premium), skipping...`);
            }
            return [];
        }
        // Other errors (500, 404 etc.) – better to throw an error
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    let posts: { id: number; tag_string: string }[];
    try {
        posts = await res.json();
    } catch (err) {
        console.warn(`[A] JSON parse error on page ${apiPage}, skipping...`);
        return []
    }

    if (!Array.isArray(posts)) {
        console.warn(`[A] Invalid response format on page ${apiPage}`);
        return [];
    }

    return posts;
}
