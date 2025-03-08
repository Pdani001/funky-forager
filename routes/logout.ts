import express from "express";
import { WebRoute } from "..";
const router = express.Router();

const route: WebRoute = {
  name: "logout",
  path: "/logout",
  router,
};

router.get(route.path, (req, res) => {
  res.clearCookie("token");
  res.clearCookie("refresh");
  res.clearCookie("guild");
  return res.redirect("/");
});

export = route;
