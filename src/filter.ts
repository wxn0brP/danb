import { hasFieldsAdvanced } from "@wxn0brp/db-core/utils/hasFieldsAdvanced";
import { TAG_LIMIT } from "./vars";

const FREE_META_PREFIXES = [
    "score:", "id:", "date:", "age:", "md5:",
    "width:", "height:", "mpixels:", "filesize:", "filetype:",
    "duration:", "status:", "tagcount:", "parent:", "child:",
    "pixiv_id:", "pixiv:", "embedded:", "limit:"
];

const LIMITED_META_PREFIXES = ["order:", "rating:", "user:", "source:", "ratio:"];

export function isMetaTag(tag: string): boolean {
    const lower = tag.toLowerCase();
    return FREE_META_PREFIXES.some(p => lower.startsWith(p)) ||
        LIMITED_META_PREFIXES.some(p => lower.startsWith(p));
}

export function isFreeMetaTag(tag: string): boolean {
    const lower = tag.toLowerCase();
    return FREE_META_PREFIXES.some(p => lower.startsWith(p));
}

export function isLimitedMetaTag(tag: string): boolean {
    const lower = tag.toLowerCase();
    return LIMITED_META_PREFIXES.some(p => lower.startsWith(p));
}

export function groupTags(tags: string[]) {
    const stack: string[][] = [];

    for (const tag of tags) {
        if (tag.toLowerCase() === "o") {
            if (stack.length < 2)
                throw new Error(`[400] "O" requires at least 2 preceding groups`);
            const last = stack.pop()!;
            const secondLast = stack.pop()!;
            stack.push([...secondLast, ...last]);

        } else if (tag.startsWith("~")) {
            if (stack.length < 1)
                throw new Error(`[400] "~" requires a preceding tag`);
            const last = stack.pop()!;
            stack.push([...last, tag.slice(1)]);

        } else {
            stack.push([tag]);
        }
    }

    for (const group of stack)
        if (group.length > 1 && group.some(t => t.startsWith("-")))
            throw new Error("[400] Negation (-) is not allowed inside OR groups");

    return stack;
}

export function parseToQuery(tags: string[], excludeTags?: string[]) {
    const groups = groupTags(tags);
    const andTags: string[] = [];
    const orGroups: string[][] = [];
    const notTags: string[] = [];

    for (const group of groups) {
        const exclusions = group.filter(t => t.startsWith("-"));
        const inclusions = group.filter(t => !t.startsWith("-"));

        if (group.length === 1) {
            const tag = group[0];
            if (tag.startsWith("-")) {
                const inner = tag.slice(1);
                if (isMetaTag(inner)) continue;
                notTags.push(inner.toLowerCase());
            } else if (isMetaTag(tag)) {
                continue;
            } else {
                andTags.push(tag.toLowerCase());
            }
        } else {
            const hasMeta = group.some(t => isMetaTag(t));
            if (hasMeta) continue;

            if (inclusions.length > 0)
                orGroups.push(inclusions.map(t => t.toLowerCase()));

            for (const excl of exclusions) {
                const inner = excl.slice(1);
                if (isMetaTag(inner)) continue;
                notTags.push(inner.toLowerCase());
            }
        }
    }

    const excludeClean = excludeTags?.map(t => {
        const clean = t.startsWith("~") ? t.slice(1) : t.startsWith("-") ? t.slice(1) : t;
        return clean.toLowerCase();
    });

    const remainingAnd = excludeClean
        ? andTags.filter(t => !excludeClean.includes(t))
        : andTags;

    const remainingOr = excludeClean
        ? orGroups.map(g => g.filter(t => !excludeClean.includes(t))).filter(g => g.length > 0)
        : orGroups;

    const remainingNot = excludeClean
        ? notTags.filter(t => !excludeClean.includes(t))
        : notTags;

    const conditions: object[] = [];

    if (remainingAnd.length > 0)
        conditions.push({ $arrincall: { tags: remainingAnd } });

    for (const orGroup of remainingOr)
        conditions.push({ $arrinc: { tags: orGroup } });

    for (const notTag of remainingNot)
        conditions.push({ $not: { $arrinc: { tags: [notTag] } } });

    return conditions.length > 0 ?
        { $and: conditions } :
        {};
}

export function createPostFilter(query: object) {
    return (post: { tag_string: string }) => {
        const tags = post.tag_string
            .split(" ")
            .map(t => t.trim().toLowerCase());

        const wrapper = { tags, ...post };
        return hasFieldsAdvanced(wrapper, query);
    };
}

export interface SelectedTags {
    freeMeta: string[];
    limitedMeta: string[];
    regularTags: string[];
}

export function selectApiTags(tags: string[]): SelectedTags {
    const groups = groupTags(tags);

    const freeMeta: string[] = [];
    const limitedMeta: string[] = [];
    const andTags: string[] = [];
    const orGroups: string[][] = [];
    const notTags: string[] = [];

    for (const group of groups) {
        if (group.length === 1) {
            const tag = group[0];
            if (tag.startsWith("-")) {
                const inner = tag.slice(1);
                if (isLimitedMetaTag(inner)) continue;
                notTags.push(tag);
            } else if (isFreeMetaTag(tag)) {
                freeMeta.push(tag);
            } else if (isLimitedMetaTag(tag)) {
                limitedMeta.push(tag);
            } else {
                andTags.push(tag);
            }
        } else if (group.length > 1) {
            const hasMeta = group.some(t => isMetaTag(t));
            if (hasMeta) continue;
            orGroups.push(group);
        }
    }

    if (andTags.length > 0 || notTags.length > 0)
        return { freeMeta, limitedMeta, regularTags: [...andTags, ...notTags] };

    if (orGroups.length === 1 && orGroups[0].length <= TAG_LIMIT) {
        const orGroup = orGroups[0];
        return { freeMeta, limitedMeta, regularTags: orGroup.map((t, i) => i === 0 ? t : `~${t}`) };
    }

    if (freeMeta.length > 0 || limitedMeta.length > 0)
        return { freeMeta, limitedMeta, regularTags: [] };

    throw new Error("No AND tags and OR group exceeds TAG_LIMIT");
}
