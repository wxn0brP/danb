
export function flag(n: string, bit: Flags): boolean {
    return n[bit] === "1";
}

export enum Flags {
    POSTS,
    POSTS_DEBUG,
    REDIRECT,
}
