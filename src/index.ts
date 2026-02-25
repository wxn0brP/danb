import { getFilteredPage } from "./api.get";
import { flag, Flags } from "./flags";
import { app, logs, port, SERVER_URL } from "./vars";

if (process.argv.includes("-h")) await import("./help");

app.get("/posts.json", async (req, res, next) => {
    const tags = decodeURIComponent(req.query.tags as string)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (tags.length === 0) return [];
    if (tags.length <= 2) return next();

    const clientPage = Math.max(1, parseInt((req.query.page as string) || "1", 10));

    try {
        if (flag(logs, Flags.POSTS))
            console.log(`[P] Requested fetching page ${clientPage} for: ${tags}`);

        const start = Date.now();
        let result = await getFilteredPage(tags, clientPage);
        const end = Date.now();

        if (flag(logs, Flags.POSTS))
            console.log(`[P] getFilteredPage took ${end - start}ms`);

        res.setHeader("Access-Control-Allow-Origin", "*");
        return result;
    } catch (err) {
        console.error(err);
        res.status(500).end("Error fetching or filtering posts");
    }
});

app.get("/autocomplete.json", (req, res) => {
    const searchQuery = req.query["search[query]"];

    req.query["search[query]"] = `*${searchQuery}*`.replaceAll("**", "*");

    const url = "/autocomplete.json?" + new URLSearchParams(req.query).toString();

    if (flag(logs, Flags.REDIRECT))
        console.log(`[X] Proxying ${url}`);
    res.redirect(SERVER_URL + url);
});

app.all("*", async (req, res) => {
    if (flag(logs, Flags.REDIRECT))
        console.log(`[X] Proxying ${req.url}`);
    res.redirect(SERVER_URL + req.url);
});

app.listen(port, true);
