import { hasFieldsAdvanced } from "@wxn0brp/db-core/utils/hasFieldsAdvanced";

function groupTags(tags: string[]) {
    const stack: string[][] = [];

    for (const tag of tags) {
        if (tag.toLowerCase() === "o") {
            if (stack.length >= 2) {
                const last = stack.pop()!;
                const secondLast = stack.pop()!;
                stack.push([...secondLast, ...last]);
            }

        } else if (tag.startsWith("~")) {
            if (stack.length >= 1) {
                const last = stack.pop()!;
                stack.push([...last, tag.slice(1)]);
            } else {
                stack.push([tag]);
            }

        } else {
            stack.push([tag]);
        }
    }

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
            if (tag.startsWith("-"))
                notTags.push(tag.slice(1));
            else
                andTags.push(tag);
        } else {
            if (inclusions.length > 0)
                orGroups.push(inclusions);

            for (const excl of exclusions)
                notTags.push(excl.slice(1));
        }
    }

    const excludeClean = excludeTags?.map(t => t.startsWith("~") ? t.slice(1) : t);

    const remainingAnd = excludeClean
        ? andTags.filter(t => !excludeClean.includes(t))
        : andTags;

    const remainingOr = excludeClean
        ? orGroups.map(g => g.filter(t => !excludeClean.includes(t))).filter(g => g.length > 0)
        : orGroups;

    const conditions: object[] = [];

    if (remainingAnd.length > 0)
        conditions.push({ $arrincall: { tags: remainingAnd } });

    for (const orGroup of remainingOr)
        conditions.push({ $arrinc: { tags: orGroup } });

    for (const notTag of notTags)
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

export function selectApiTags(tags: string[]) {
    const andTags = getAndTags(tags);
    if (andTags.length > 0) return andTags;

    for (let i = 0; i < tags.length; i++)
        if (tags[i].startsWith("~") && i > 0 && tags[i - 1].toLowerCase() !== "o")
            return [tags[i - 1], tags[i]];

    return [];
}

export function getAndTags(tags: string[]) {
    const groups = groupTags(tags);
    const result: string[] = [];
    for (const group of groups)
        if (group.length === 1)
            result.push(group[0]);
    return result;
}
