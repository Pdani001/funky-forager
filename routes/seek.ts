import express from "express";
import { WebRoute } from "..";
import createError from "http-errors";
import { getPlayer } from "../GuildPlayer";
const router = express.Router();

const route: WebRoute = {
  name: "seek",
  path: "/seek/:time",
  router,
};

router.get(route.path, async (req, res) => {
  let player = getPlayer(process.env.SERVER_ID);
  if(!player){
    res.status(500).send(createError(500, "player not found"));
    return;
  }
  let time = parseInt(req.params.time);
  if(isNaN(time)){
    res.status(400).send(createError(400,"invalid time"));
    return;
  }
  player.seek(time);
  res.send({message:"request submitted", guild: process.env.SERVER_ID});
});

export = route;