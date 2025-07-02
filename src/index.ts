import FalconFrame from "@wxn0brp/falcon-frame";
import { getContentType } from "@wxn0brp/falcon-frame/helpers";
import ky from "ky";
import NodeCache from "node-cache";

const DANBOORU_API = "https://danbooru.donmai.us";
const TAG_LIMIT = +process.env.TAG_LIMIT || 2;
const PAGE_LIMIT = +process.env.PAGE_LIMIT || 200;
const LOCAL_PAGE_SIZE = +process.env.LOCAL_PAGE_SIZE || 2;
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

let logs = process.argv[2] || process.env.LOGS || "0";
if (logs.length < 3) logs = logs.padEnd(3, "0");

const app = new FalconFrame();

const cache = new NodeCache({
    stdTTL: 60 * 30,
    checkperiod: 60 * 15
});

/**
 * Get a page of posts from Danbooru, filtered by the given tags.
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

    // Start by fetching the page that the user requested
    let danbooruPage = clientPage;

    // If the user has already fetched previous pages, use the cached result page offset
    const cacheKey = `${allTags.join(',')}::${clientPage-1}`;
    if (cache.has(cacheKey)) {
        danbooruPage = +cache.get(cacheKey);
    }

    let collected: any[] = [];

    while (true) {
        const query = new URLSearchParams({
            tags: primaryTags.join(" "),
            page: danbooruPage.toString(),
            limit: PAGE_LIMIT.toString()
        });

        const url = `${DANBOORU_API}/posts.json?${query}`;
        if (flag(logs, Flags.POSTS_DEBUG)) console.log(`[D] Fetching page ${danbooruPage} of ${primaryTags.join(",")}`);

        const start = Date.now();
        const res = await ky(url);
        const end = Date.now();
        if (flag(logs, Flags.POSTS_DEBUG)) console.log(`[D] Fetch ${url} took ${end - start}ms`);

        if (!res.ok) throw new Error(`Danbooru error: ${res.status}`);
        const posts = await res.json();

        // If there are no posts, we're done
        if (!Array.isArray(posts) || posts.length === 0) break;

        // Filter the posts by the secondary tags
        const filtered = posts.filter(post =>
            filterTags.every(tag => post.tag_string.includes(tag))
        );

        collected.push(...filtered);

        if (collected.length >= offset + LOCAL_PAGE_SIZE) break;
        if (posts.length < PAGE_LIMIT) break;
        danbooruPage++;
    }

    // If we've fetched more pages than the user requested, cache the result
    if (danbooruPage > clientPage) {
        cache.set(`${allTags.join(',')}::${clientPage}`, danbooruPage);
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

    const url = `${DANBOORU_API}${req.url}`;
    const start = Date.now();
    const proxied = await ky(url);
    const end = Date.now();
    if (flag(logs, Flags.REDIRECT)) console.log(`[P] Proxy ${url} took ${end - start}ms`);

    const body = await proxied.text();
    const filename = url.split("?")[0].split("/").pop();

    res.status(proxied.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", proxied.headers.get("Content-Type") || getContentType(filename) || "text/plain");
    res.end(body);
});

app.listen(port, () => {
    console.log(`Danbooru smart-filter proxy running on http://localhost:${port}`);
});

