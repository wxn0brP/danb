import { Flags } from "./flags";

console.log(`Usage: ${process.argv[0]} ${process.argv[1]} [flags] [port]`);
let flags = "";
for (const key of Object.keys(Flags)) {
    if (!isNaN(+key)) continue;
    flags += `{${key}}`;
}
console.log("Flags:", flags);
console.log("E.g.:", "111,", "101,", "010");
process.exit(0);
