# danb

A proxy server for the Danbooru API that filters posts by tags and provides a paginated API.

Node:

```bash
npm i
npm run build
node .
```

Bun:

```bash
bun i
bun run src/index.ts
```

The server will be available at `http://localhost:14569`.

## API

### `GET /posts.json`

Get a page of posts filtered by tags.

**Query Parameters:**

*   `tags`: A space-separated list of tags to filter by.
*   `page`: The page number to retrieve.

## Configuration

The server can be configured using environment variables.

*   `SERVER_URL`: The base URL of the booru server.
    *   Default: `https://danbooru.donmai.us`
*   `TAG_LIMIT`: The maximum number of tags to use for the primary filter.
    *   Default: `2`
*   `PAGE_LIMIT`: The number of posts to fetch from the API per page.
    *   Default: `200`
*   `LOCAL_PAGE_SIZE`: The number of posts to return to the client per page.
    *   Default: `30`
*   `MAX_EMPTY_CHECK`: The maximum number of consecutive empty pages to check before stopping.
    *   Default: `10`
*   `PORT`: The port to run the server on.
    *   Default: `14569`
*   `LOGS`: A 3-digit string to enable/disable logging for different parts of the application.
    *   `POSTS`: The first digit enables/disables logging for post fetching.
    *   `POSTS_DEBUG`: The second digit enables/disables debug logging for post fetching.
    *   `REDIRECT`: The third digit enables/disables logging for redirects.
    *   E.g.: `111` enables all logs, `101` enables logs for post fetching and redirects.
    *   Default: `000` (all logs disabled)
    *   ARGUMENT override ENVIRONMENT VARIABLE
