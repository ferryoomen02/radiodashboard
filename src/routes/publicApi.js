import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import {
  buildPublicStationPayload,
  findActiveStationByPublicSlug,
} from "../lib/publicStation.js";

export const publicApiRouter = Router();

/**
 * GET /api/public/station
 * Host-header bepaalt tenant. Centraal: mode central, station null.
 */
publicApiRouter.get(
  "/public/station",
  asyncHandler(async (req, res) => {
    const slug = req.tenantSlug;
    if (!slug) {
      return res.json({
        mode: "central",
        station: null,
        links: {
          centralPortalUrl: process.env.CENTRAL_PORTAL_URL?.trim() || null,
        },
      });
    }

    const row = await findActiveStationByPublicSlug(slug);
    if (!row) {
      return res.status(404).json({
        mode: "unknown",
        error: "Deze zender bestaat niet of is niet actief.",
        slug,
      });
    }

    const station = await buildPublicStationPayload(row);
    const centralPortalUrl = process.env.CENTRAL_PORTAL_URL?.trim() || null;
    return res.json({
      mode: "station",
      station,
      links: {
        centralPortalUrl,
      },
    });
  })
);
