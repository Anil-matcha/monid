import { z } from "zod";
import { zJson } from "../json/type.ts";

export const zHttpMethod = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);
export type HttpMethod = z.infer<typeof zHttpMethod>;

/**
 * Outgoing request parts as seen (and returned) by the auth fn.
 *
 * `query` is a MULTIMAP — which is what a query string actually is (it is
 * exactly what `URLSearchParams` models): every key holds one OR MORE
 * values. A single value is `["v"]`, so nothing downstream branches on
 * `string | string[]`. Several values are sent as a REPEATED key
 * (`?k=a&k=b`) — the HTTP-native reading, and the only list spelling the
 * engine knows. A vendor that spells lists another way (akta joins them
 * with commas) does so in its own `input.toRequest`, before the values
 * ever reach here.
 */
export const zHttpRequestParts = z.object({
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()),
    query: z.record(z.string(), z.array(z.string()).min(1)),
    body: zJson.optional(),
}).strict();
export type HttpRequestParts = z.infer<typeof zHttpRequestParts>;
