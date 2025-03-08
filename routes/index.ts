import express from "express";
import { WebRoute } from "..";
const router = express.Router();

const route: WebRoute = {
  name: "index",
  path: "/",
  router,
};

router.get(route.path, (req, res) => {
  if (!req.cookies["token"]) {
    return res.redirect("/auth");
  }
  return res.render("index", { target: "mom", query: req.query });
});

export = route;