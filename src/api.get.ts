import { AnotherCache } from "@wxn0brp/ac";
import { fetchApiPage } from "./api.utils";
import { LOCAL_PAGE_SIZE, MAX_EMPTY_CHECK, TAG_LIMIT } from "./vars";
import { sortTags } from "./tagCount";

const cache = new AnotherCache<number>();
cache._ttl = 60 * 60 * 1000;

const unusedCache = new AnotherCache<Object[]>();
unusedCache._ttl = 60 * 60 * 1000;

const prefetchData = {
    key: "",
    data: null,
    promise: Promise.resolve(),
    abort: false,
    end: true
}

function queuePrefetch(tags: string[], sortedTags: string[], clientPage: number) {
    prefetchData.key = tags.join("|");
    prefetchData.abort = false;
    prefetchData.end = false;
    prefetchData.promise = new Promise(async (resolve) => {
        getFilteredPage(sortedTags, clientPage + 1, true)
            .then(result => {
                prefetchData.data = result;
                resolve()
            })
            .catch(() => [])
    });
    console.log("[F] Queuing prefetch");
}

export async function getFilteredPage(allTags: string[], clientPage: number, prefetch = false): Promise<Object[]> {
    const sortedTags = await sortTags(allTags);
    const cachePrefix = `${sortedTags.join("|")}:`;

    if (!prefetch && !prefetchData.end) {
        if (prefetchData.key !== sortedTags.join("|")) {
            prefetchData.abort = true;
            await prefetchData.promise;
            prefetchData.abort = false;
            console.log(`[F] Aborting prefetch process`);
        } else {
            console.log(`[F] Assign to prefetch process`);
            await prefetchData.promise;
        }
    }

    if (!prefetch && prefetchData.end && prefetchData.data) {
        console.log(`[F] Getting prefetch data`);
        const { data } = prefetchData;
        prefetchData.data = null;
        setTimeout(() => {
            queuePrefetch(sortedTags, sortedTags, clientPage);
        }, 10);
        return data;
    }

    const primaryTags = sortedTags.slice(0, TAG_LIMIT);
    const filterTags = sortedTags.slice(TAG_LIMIT);

    let apiPage = cache.get(`${cachePrefix}${clientPage - 1}`) || clientPage;
    const startPage = apiPage;

    let collected: any[] = [];
    let consecutiveEmptyPages = 0;
    let lastRealPage = 0;

    if (clientPage > 1) {
        const cached = unusedCache.get(`${cachePrefix}${clientPage - 1}`);
        if (cached !== undefined)
            collected.push(...cached);
    }

    while (collected.length < LOCAL_PAGE_SIZE) {
        if (prefetchData.abort) {
            return [];
        }

        const posts = await fetchApiPage(apiPage, primaryTags);

        if (posts.length === 0) {
            consecutiveEmptyPages++;
            if (consecutiveEmptyPages >= MAX_EMPTY_CHECK) {
                break; // Really end
            }
            apiPage++;
            continue;
        } else {
            lastRealPage = apiPage;
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

    cache.set(`${cachePrefix}${clientPage}`, apiPage);

    const used = collected.slice(0, LOCAL_PAGE_SIZE);
    const unused = collected.slice(LOCAL_PAGE_SIZE);

    unusedCache.set(`${cachePrefix}${clientPage}`, unused);

    if (!prefetch && lastRealPage - startPage > 2)
        queuePrefetch(sortedTags, sortedTags, clientPage);

    if (prefetch) {
        prefetchData.end = true;
        console.log(`[F] Prefetch complete`);
    }

    return used;
}
