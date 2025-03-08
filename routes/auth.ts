import express from "express";
import { WebRoute } from "..";
import DiscordOauth2 from "discord-oauth2";
const router = express.Router();
const oauth = new DiscordOauth2({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: "https://funky.pghost.org/auth",
});
const route: WebRoute = {
  name: "auth",
  path: "/auth",
  router,
};

router.get(route.path, async (req, res) => {
  if (req.cookies["token"]) {
    return res.redirect("/");
  }
  if (req.query.code) {
    try {
      const discord = await oauth.tokenRequest({
        code: req.query.code.toString(),
        scope: "identify guilds",
        grantType: "authorization_code",
      });
      // const user = await oauth.getUser(discord.access_token);
      // const DiscordData = {
      //   id: user.id,
      //   name: user.username,
      //   access_token: discord.access_token,
      //   refresh_token: discord.refresh_token,
      //   access_expires: discord.expires_in * 1000 + Date.now(),
      //   expires_in: discord.expires_in,
      // };
      res.cookie("token", discord.access_token, {
        maxAge: discord.expires_in * 1000,
        httpOnly: true,
        secure: true,
      });
      res.cookie("refresh", discord.refresh_token, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // (DAY * HOUR * MINUTE * SECOND) * MILLISECOND
        httpOnly: true,
        secure: true,
      });
      return res.redirect("/");
    } catch (e) {
      return res.render("auth", { error: e });
    }
  }
  if (req.cookies["refresh"]) {
    try {
      const discord = await oauth.tokenRequest({
        refreshToken: req.cookies["refresh"],
        grantType: "refresh_token",
        scope: "identify guilds",
      });
      // const user = await oauth.getUser(discord.access_token);
      // const DiscordData = {
      //   id: user.id,
      //   name: user.username,
      //   access_token: discord.access_token,
      //   refresh_token: discord.refresh_token,
      //   access_expires: discord.expires_in * 1000 + Date.now(),
      //   expires_in: discord.expires_in,
      // };
      res.cookie("token", discord.access_token, {
        maxAge: discord.expires_in * 1000,
        httpOnly: true,
        secure: true,
      });
      res.cookie("refresh", discord.refresh_token, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // (DAY * HOUR * MINUTE * SECOND) * MILLISECOND
        httpOnly: true,
        secure: true,
      });
      return res.redirect("/");
    } catch (e) {
      return res.render("auth", { error: e });
    }
  }
  return res.redirect(
    "https://discord.com/api/oauth2/authorize?client_id=1093513107059519558&redirect_uri=https%3A%2F%2Ffunky.pghost.org%2Fauth&response_type=code&scope=identify%20guilds"
  );
});

export = route;