export function removeOperators(tags: string[]): string[] {
    return tags.filter(t => t.toLowerCase() !== "o");
}

export function getAndTags(tags: string[]): string[] {
    const stack: string[][] = [];

    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];

        if (tag.toLowerCase() === "o") {
            if (stack.length >= 2) {
                const last = stack.pop()!;
                const secondLast = stack.pop()!;
                stack.push([...secondLast, ...last]);
            }
        } else if (tag.startsWith("-")) {
            stack.push([tag]);
        } else {
            stack.push([tag]);
        }
    }

    const result: string[] = [];
    for (const group of stack) {
        if (group.length === 1) {
            result.push(group[0]);
        }
    }

    return result;
}

export function filterPosts(filterTags: string[]) {
    return (post: { tag_string: string }) => {
        const postTags = post.tag_string
            .split(" ")
            .map(t => t.trim().toLowerCase());

        const normalizedFilters = filterTags.map(t => t.trim().toLowerCase());

        return evaluateFilters(normalizedFilters, postTags);
    }
}

function evaluateFilters(filters: string[], postTags: string[]): boolean {
    const stack: string[][] = [];

    for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];

        if (filter === "o") {
            if (stack.length >= 2) {
                const last = stack.pop()!;
                const secondLast = stack.pop()!;
                stack.push([...secondLast, ...last]);
            }
        } else if (filter.startsWith("-"))
            stack.push([filter]);
        else
            stack.push([filter]);
    }

    for (const group of stack) {
        if (group.length === 1) {
            const tag = group[0];
            if (tag.startsWith("-"))
                if (postTags.includes(tag.slice(1)))
                    return false;

                else
                    if (!postTags.includes(tag))
                        return false;

        } else {
            const inclusionTags = group.filter(t => !t.startsWith("-"));
            const exclusionTags = group.filter(t => t.startsWith("-"));

            for (const excl of exclusionTags)
                if (postTags.includes(excl.slice(1)))
                    return false;

            if (inclusionTags.length > 0) {
                const orMatch = inclusionTags.some(tag => postTags.includes(tag));
                if (!orMatch)
                    return false;
            }
        }
    }

    return true;
}
