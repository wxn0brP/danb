import FalconFrame from "@wxn0brp/falcon-frame";

export const SERVER_URL = process.env.SERVER_URL || "https://danbooru.donmai.us";
export const TAG_LIMIT = +process.env.TAG_LIMIT || 2;
export const PAGE_LIMIT = +process.env.PAGE_LIMIT || 200;
export const LOCAL_PAGE_SIZE = +process.env.LOCAL_PAGE_SIZE || 30;
export const MAX_EMPTY_CHECK = +process.env.MAX_EMPTY_CHECK || 10;
export const port = +process.argv[3] || +process.env.PORT || 14569;

export const app = new FalconFrame();

export let logs = process.argv[2] || process.env.LOGS || "110";
if (logs.length < 3) logs = logs.padEnd(3, "0");
