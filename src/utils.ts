export function sanitizeTag(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}
