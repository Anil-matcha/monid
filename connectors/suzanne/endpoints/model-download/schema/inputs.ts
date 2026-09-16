import { z } from "zod";
import { zFormat, zJobId } from "../../../schema/common.ts";

/** `GET /v1/models/{job_id}/download` path params. */
export const zDownloadPathParams = z.object({ job_id: zJobId });

/**
 * `GET /v1/models/{job_id}/download` query params. The vendor documents no
 * server-side default for `format`, so the binding REQUIRES it rather than
 * inventing one client-side (v1 defaulted to glb).
 */
export const zDownloadQueryParams = z.object({ format: zFormat });
