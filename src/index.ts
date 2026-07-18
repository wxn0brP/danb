import { createDebug } from "@wxn0brp/falcon-frame/debug";
import { getFilteredPage } from "./api.get";
import { isFreeMetaTag } from "./filter";
import { flag, Flags } from "./flags";
import { app, logs, port, SERVER_URL, TAG_LIMIT } from "./vars";

if (process.argv.includes("-h")) await import("./help");

app.use(createDebug());

app.get("/posts.json", async (req, res, next) => {
    const tags = decodeURIComponent(req.query.tags as string)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);

    const limitedCount = tags.filter(t => !isFreeMetaTag(t)).length;
    if (limitedCount <= TAG_LIMIT) return next();

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
        const msg = (err as Error)?.message || "";
        if (msg.startsWith("[400] ")) {
            console.warn(msg);
            res.status(400).end(msg.slice(6));
        }
        else {
            console.error(err);
            res.status(500).end("Error fetching or filtering posts");
        }
    }
});

app.get("/", () => "Server is running.");

app.all("*", async (req, res) => {
    if (flag(logs, Flags.REDIRECT))
        console.log(`[X] Proxying ${req.url}`);
    res.redirect(SERVER_URL + req.url);
});

app.listen(port, true);
