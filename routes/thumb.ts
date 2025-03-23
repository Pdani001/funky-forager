import express from "express";
import { WebRoute } from "..";
import { Track } from "../Track";
import createError from "http-errors";
const router = express.Router();

const route: WebRoute = {
  name: "thumb",
  path: "/thumb/:id",
  router,
};

router.get(route.path, async (req, res) => {
  res.set("Cache-Control", "public, max-age=604800");
  let trackId = req.params.id;
  let track = await Track.findByPk(trackId);
  if (!track || !track.metadata.thumbnail) {
    res.status(404).send(createError(404, "track or thumb not found"));
    return;
  }
  res.sendFile(track.metadata.thumbnail);
});

export = route;