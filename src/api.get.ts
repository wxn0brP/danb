import { AnotherCache } from "@wxn0brp/ac";
import { fetchApiPage } from "./api.utils";
import { createPostFilter, parseToQuery, selectApiTags } from "./filter";
import { sortTags } from "./tagCount";
import { LOCAL_PAGE_SIZE, MAX_EMPTY_CHECK, TAG_LIMIT } from "./vars";

const cache = new AnotherCache<number>();
cache.options.ttl = 60 * 60 * 1000;

const unusedCache = new AnotherCache<Object[]>();
unusedCache.options.ttl = 60 * 60 * 1000;

const prefetchData = {
	key: "",
	data: null,
	promise: Promise.resolve(),
	abort: false,
	end: true,
};

function queuePrefetch(
	tags: string[],
	sortedTags: string[],
	clientPage: number,
) {
	prefetchData.key = tags.join("|");
	prefetchData.abort = false;
	prefetchData.end = false;
	prefetchData.promise = new Promise(resolve => {
		getFilteredPage(sortedTags, clientPage + 1, true)
			.then(result => {
				prefetchData.data = result;
				resolve();
			})
			.catch(() => []);
	});
	console.log("[F] Queuing prefetch");
}

export async function getFilteredPage(
	allTags: string[],
	clientPage: number,
	prefetch = false,
): Promise<Object[]> {
	const { freeMeta, limitedMeta, regularTags } = selectApiTags(allTags);
	const hasTilde = regularTags.some(t => t.startsWith("~"));
	const sortedRegular = hasTilde ? regularTags : await sortTags(regularTags);
	const availableSlots = Math.max(0, TAG_LIMIT - limitedMeta.length);
	const primaryTags = [
		...freeMeta,
		...limitedMeta,
		...sortedRegular.slice(0, availableSlots),
	];
	const cachePrefix = `${primaryTags.join("|")}:`;

	if (!prefetch && !prefetchData.end) {
		if (prefetchData.key !== primaryTags.join("|")) {
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
			queuePrefetch(primaryTags, primaryTags, clientPage);
		}, 10);
		return data;
	}

	const query = parseToQuery(allTags, primaryTags);
	const postFilter = createPostFilter(query);
	console.log(`[F] Query`);
	console.dir(query, {
		depth: null,
	});
	console.dir(primaryTags);

	let apiPage = cache.get(`${cachePrefix}${clientPage - 1}`) || clientPage;
	const startPage = apiPage;

	const collected: any[] = [];
	let consecutiveEmptyPages = 0;
	let lastRealPage = 0;

	if (clientPage > 1) {
		const cached = unusedCache.get(`${cachePrefix}${clientPage - 1}`);
		if (cached !== undefined) collected.push(...cached);
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

		consecutiveEmptyPages = 0;

		const filtered = posts.filter(postFilter);

		collected.push(...filtered);
		apiPage++;
	}

	cache.set(`${cachePrefix}${clientPage}`, apiPage);

	const used = collected.slice(0, LOCAL_PAGE_SIZE);
	const unused = collected.slice(LOCAL_PAGE_SIZE);

	unusedCache.set(`${cachePrefix}${clientPage}`, unused);

	if (!prefetch && lastRealPage - startPage > 2)
		queuePrefetch(primaryTags, primaryTags, clientPage);

	if (prefetch) {
		prefetchData.end = true;
		console.log(`[F] Prefetch complete`);
	}

	return used;
}
