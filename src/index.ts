import { AnotherCache } from "@wxn0brp/ac";
import FalconFrame from "@wxn0brp/falcon-frame";

const SERVER_URL = process.env.SERVER_URL || "https://danbooru.donmai.us";
const TAG_LIMIT = +process.env.TAG_LIMIT || 2;
const PAGE_LIMIT = +process.env.PAGE_LIMIT || 200;
const LOCAL_PAGE_SIZE = +process.env.LOCAL_PAGE_SIZE || 30;
const MAX_EMPTY_CHECK = +process.env.MAX_EMPTY_CHECK || 10;
const port = +process.argv[3] || +process.env.PORT || 14569;

function flag(n: string, bit: Flags): boolean {
    return n[bit] === "1";
}

enum Flags {
    POSTS,
    POSTS_DEBUG,
    REDIRECT,
}

if (process.argv.includes("-h")) {
    console.log(`Usage: ${process.argv[0]} ${process.argv[1]} [flags] [port]`);
    let flags = "";
    for (const key of Object.keys(Flags)) {
        if (!isNaN(+key)) continue;
        flags += `{${key}}`;
    }
    console.log("Flags:", flags);
    console.log("E.g.:", "111,", "101,", "010");
    process.exit(0);
}

let logs = process.argv[2] || process.env.LOGS || "110";
if (logs.length < 3) logs = logs.padEnd(3, "0");

const app = new FalconFrame();

const cache = new AnotherCache<number>();

/**
 * Get a page of posts from booru server, filtered by the given tags.
 *
 * @param allTags - The tags to filter by. The first `TAG_LIMIT` tags are used
 * as the primary tags, and any additional tags are treated as secondary tags.
 * @param clientPage - The page number the user requested.
 * @returns - A Promise that resolves with an array of posts, filtered by the
 * given tags.
 */
async function getFilteredPage(allTags: string[], clientPage: number): Promise<any[]> {
    const primaryTags = allTags.slice(0, TAG_LIMIT);
    const filterTags = allTags.slice(TAG_LIMIT);

    const offset = (clientPage - 1) * LOCAL_PAGE_SIZE;

    // Cache key with preserved order, but normalized
    const tagsKey = allTags.map(tag => tag.trim().toLowerCase()).join("||");
    const cacheKeyPrefix = `v2:tags:${tagsKey}::`;
    const cacheStartKey = cacheKeyPrefix + `startPage:${clientPage}`;

    // Get the page to start from
    let apiPage = clientPage;
    if (cache.has(cacheStartKey)) {
        const cachedPage = cache.get(cacheStartKey);
        if (typeof cachedPage === "number" && cachedPage >= 1) {
            apiPage = cachedPage;
        }
    }

    let collected: any[] = [];
    let consecutiveEmptyPages = 0;

    while (collected.length < offset + LOCAL_PAGE_SIZE) {
        const query = new URLSearchParams({
            tags: primaryTags.join(" "),
            page: apiPage.toString(),
            limit: PAGE_LIMIT.toString(),
        });

        const url = `${SERVER_URL}/posts.json?${query}`;
        if (flag(logs, Flags.POSTS_DEBUG)) {
            console.log(`[D] Fetching API page ${apiPage} for: ${primaryTags.join(", ")}`);
        }

        const start = Date.now();
        let res: Response;
        try {
            res = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10s timeout
        } catch (err) {
            if (err.name === "AbortError") {
                console.warn(`[!] Timeout fetching page ${apiPage}, skipping...`);
                apiPage++;
                continue;
            }
            throw err;
        }
        const end = Date.now();
        if (flag(logs, Flags.POSTS_DEBUG)) {
            console.log(`[D] Fetch took ${end - start}ms`);
        }

        // Handle 403/401 – no access to page (premium)
        if (!res.ok) {
            if (res.status === 403 || res.status === 401) {
                if (flag(logs, Flags.POSTS_DEBUG)) {
                    console.warn(`[!] Page ${apiPage} blocked (auth/premium), skipping...`);
                }
                apiPage++;
                continue;
            }
            // Other errors (500, 404 etc.) – better to throw an error
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        let posts: { id: number; tag_string: string }[];
        try {
            posts = await res.json();
        } catch (err) {
            console.warn(`[!] JSON parse error on page ${apiPage}, skipping...`);
            apiPage++;
            continue;
        }

        if (!Array.isArray(posts)) {
            console.warn(`[!] Invalid response format on page ${apiPage}`);
            apiPage++;
            continue;
        }

        if (posts.length === 0) {
            consecutiveEmptyPages++;
            if (consecutiveEmptyPages >= MAX_EMPTY_CHECK) {
                break; // Really end
            }
            apiPage++;
            continue;
        }

        // Reset empty pages counter
        consecutiveEmptyPages = 0;

        // Filter posts by additional tags – exact match
        const filtered = posts.filter(post => {
            const postTags = post.tag_string.split(" ").map(t => t.trim());
            return filterTags.every(tag => {
                const normalizedTag = tag.trim().toLowerCase();
                return postTags.map(t => t.toLowerCase()).includes(normalizedTag);
            });
        });

        collected.push(...filtered);
        apiPage++;
    }

    // Cache: remember that client page `clientPage` starts from approx. API page
    // Only if we moved forward
    if (apiPage > clientPage) {
        // Store safe offset – e.g. 5 pages back, to not skip
        const safeStart = Math.max(1, apiPage - 10);
        cache.set(cacheStartKey, safeStart);
    }

    // Return only the interesting page
    return collected.slice(offset, offset + LOCAL_PAGE_SIZE);
}

app.get("/posts.json", async (req, res) => {
    const tags = decodeURIComponent(req.query.tags as string)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const clientPage = Math.max(1, parseInt((req.query.page as string) || "1", 10));

    try {
        const start = Date.now();
        const result = await getFilteredPage(tags, clientPage);
        const end = Date.now();
        if (flag(logs, Flags.POSTS)) console.log(`[J] getFilteredPage took ${end - start}ms`);

        res.setHeader("Access-Control-Allow-Origin", "*");
        return result;
    } catch (err) {
        console.error(err);
        res.status(500).end("Error fetching or filtering posts");
    }
});

app.all("*", async (req, res) => {
    if (flag(logs, Flags.REDIRECT)) console.log(`[P] Proxying ${req.url}`);
    res.redirect(SERVER_URL + req.url);
});

app.listen(port, true);