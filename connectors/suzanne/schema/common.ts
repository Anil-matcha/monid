import { z } from "zod";

/**
 * Provider-shared zod fragments — the FAITHFUL VENDOR MIRROR (design D25):
 * optionality only, no `.default()`, no tightening. Every fact here is the
 * CURRENT published surface (console.suzanne3d.com/documentation, 2026-09-15),
 * not the v1 adaptor, which had drifted on the faces menu, the params block
 * and the output formats — see design D6 for the table.
 *
 * Tightening lives at the binding (`endpoint.ts`): Suzanne needs almost none,
 * because every model is flat or FREE and there is no estimate to keep exact.
 * The one derivation is photo-to-3d's inline-channel removal (design D7).
 */

// ── Models ──────────────────────────────────────────────────────────────────

/**
 * The named models Monid exposes. `capture` (multi-view reconstruction
 * requiring all four views) is published but deliberately omitted — v1 called
 * it reserved and this port keeps that (proposal non-goal).
 */
export const zModel = z.enum(["sculptor", "atelier"]).describe(
    "sculptor: game-ready meshes, fast iteration — text, 1 photo, or 2–4 " +
        "photos (auto-routed). atelier: premium fidelity with PBR materials " +
        "and detailed textures — a text prompt OR a single front photo. " +
        "Defaults to sculptor server-side.",
);

// ── Generation parameters ───────────────────────────────────────────────────

/**
 * Target polygon count — a DISCRETE menu, not a range (the vendor answers
 * `400 invalid_param` for anything else). Server default 500000. Values that
 * do not apply to a given path are clamped to the closest supported one; the
 * value actually used appears on the job row.
 */
export const zFaces = z.union([
    z.literal(200000),
    z.literal(500000),
    z.literal(1000000),
    z.literal(2000000),
]).describe(
    "Target polygon count. Server default 500000; out-of-path values are " +
        "clamped to the closest supported value.",
);

/** The `params` block — identical on text-to-3d and photo-to-3d. */
export const zParams = z.object({
    faces: zFaces.optional(),
    // `.describe()` BEFORE `.optional()` — a binding deriving a field with
    // `.unwrap()` keeps only the inner schema, so a describe hung on the
    // optional wrapper would silently vanish from the compiled doc.
    pbr: z.boolean().describe(
        "Generate PBR textures (base color + metallic-roughness + normal). " +
            "Server default true; disable for flat-shaded output.",
    ).optional(),
    quad: z.boolean().describe(
        "Produce a quad-topology mesh (for retopology and DCC tools). " +
            "Server default false. Quad meshes cap at 150000 faces and are " +
            "delivered as FBX.",
    ).optional(),
    texture_quality: z.enum(["standard", "detailed"]).describe(
        "Texture map fidelity. Server default 'detailed' for atelier, " +
            "'standard' otherwise.",
    ).optional(),
}).describe("Generation parameters.");

/**
 * Output formats to produce. GLB is the default and is always produced
 * EXCEPT for quad jobs, which are delivered as native FBX; OBJ and STL are
 * converted server-side from the GLB.
 */
export const zOutputs = z.array(z.enum(["glb", "obj", "stl", "fbx"])).describe(
    'Output formats to produce. Server default ["glb"]. OBJ/STL are ' +
        "converted from the GLB; quad jobs are delivered as FBX.",
);

/** One downloadable format — the `format` query param of model-download. */
export const zFormat = z.enum(["glb", "obj", "stl", "fbx"]).describe(
    "Format to download. Must have been listed in the job's outputs.",
);

// ── Identifiers ─────────────────────────────────────────────────────────────

/** An upload id minted by `POST /v1/uploads`. */
export const zUploadId = z.string().regex(/^upl_/).describe(
    "Upload id from the uploads endpoint (upl_<uuid>).",
);

/** A job id minted by either generation endpoint. */
export const zJobId = z.string().min(1).describe(
    "The job_id returned by a generation endpoint (job_<uuid>).",
).meta({ examples: ["job_01HZYX3QK5N8V2M4T6R9W1XC7B"] });
