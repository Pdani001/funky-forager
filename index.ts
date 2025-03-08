require("dotenv").config();
import fs from "node:fs";
import path from "node:path";
import CommandDeploy from "./CommandDeploy";
import sequelize from "./DataManager";
import { getVoiceConnection } from "@discordjs/voice";
import { CacheType, ChatInputCommandInteraction, Client, Collection, Events, GatewayIntentBits, Message, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getActivePlayers, getPlayer, getPlayerCount, GuildPlayer } from "./GuildPlayer";
import { getTranslationList, loadTranslations } from "./lang";
import express, { Router, Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { AddressInfo } from "node:net";
const web = express();
import cookieParser from "cookie-parser";
import Twig from "twig";
import { Playlist, Track, TrackUrl } from "./Track";
import crypto from "crypto";

web.set("views", path.join(__dirname, "public_html"));
web.set("view engine", "twig");

// This section is optional and can be used to configure twig.
web.set("twig options", {
  allowAsync: true,
  strict_variables: false,
});

Twig.extendFunction("path", (name: string, slug: WebRouteParam): string => {
  if (!routes.has(name)) {
    return null;
  }
  const route = routes.get(name);
  let path = route.path;
  let query = new URLSearchParams();
  const params = [...route.path.matchAll(/\/:([\w]*)/gi)].map((a) => a[1]);
  for(let p of params){
    if(!slug[p]){
      return null;
    }
    path = path.replace(":"+p,slug[p]);
  }
  for(let s in slug){
    if(params.includes(s) || s == "_keys")
      continue;
    query.append(s,slug[s]);
  }
  return path + (query.size > 0 ? "?" + query.toString() : "");
});

Twig.extendFilter("bool",(value)=>{
  if (typeof value !== "string") {
    return value;
  }
  return /^true$/i.test(value);
});

web.use(cookieParser());

const client = new Client({
  intents: [
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.Guilds,
  ],
  rest: {
    rejectOnRateLimit: [
      "/"
    ]
  }
});

if(process.env.DEBUG) client.on("debug", console.log).on("warn", console.log);

client.once(Events.ClientReady, async (readyClient) => {
  let files_dir = path.join(__dirname, "files");
  if (!fs.existsSync(files_dir)) {
    fs.mkdirSync(files_dir, "755");
  }
  const allTracks = await Track.findAll();
  const file_list = fs
    .readdirSync(files_dir)
    .filter((file) => !file.endsWith(".png"))
    .map((file) => {
      return file.slice(0, file.length - 4);
    });
  const missingTracks = allTracks.filter(
    (track) => file_list.findIndex(item=>track.id==item) == -1
  );
  await TrackUrl.destroy({
    where: {
      trackId: missingTracks.map((t) => t.id),
    },
  });
  missingTracks.forEach(async (track) => {
    await track.destroy();
    let result = await sequelize.query(
      `SELECT * FROM \`playlist\` WHERE JSON_CONTAINS(${sequelize.escape(
        `"${track.id}"`
      )});`,
      {
        model: Playlist,
        mapToModel: true,
      }
    );
    result.forEach(playlist=>{
      let tracks: string[] = playlist.getDataValue("tracks");
      let updated = tracks.filter((item) => item != track.id);
      if(updated.length == 0){
        playlist.destroy();
      } else {
        playlist.setDataValue("tracks",updated);
        playlist.save();
      }
    })
  });
  const duplicates = file_list.filter(
    (item, index) => file_list.indexOf(item) !== index
  );
  duplicates.forEach(async (id) => {
    let music_file = path.join(files_dir, id + ".mp3");
    fs.unlinkSync(music_file);
    let video_file = path.join(files_dir, id + ".mp4");
    fs.unlinkSync(video_file);
    let track = await Track.findOne({
      where: {
        id
      }
    });
    if(track){
      await TrackUrl.destroy({
        where: {
          trackId: track.id,
        },
      });
      await track.destroy();
    }
  });
  const hashless = allTracks.filter(track=>!track.hash);

  for(let track of hashless){
    let music_file = path.join(files_dir, track.id + ".mp3");
    let hash = crypto.createHash("md5");
    fs.createReadStream(music_file).on("data", (data)=>{
      hash.update(data);
    }).on("end", ()=>{
      let file_hash: string = hash.digest("hex");
      track.setDataValue("hash", file_hash);
      track.save();
    });
  }

  sequelize.sync();
  

  console.log(new Date(),`Ready! Logged in as \`${readyClient.user.tag}\``);
});

const AutoKill: Collection<string,NodeJS.Timeout> = new Collection();
function startAutoKill(player: GuildPlayer){
  if(process.env.DEBUG) console.log(new Date(), `[guild:${player.guildId}]`, "autokill started");
  AutoKill.set(
    player.guildId,
    setTimeout(() => {
      if(process.env.DEBUG) console.log(new Date(), `[guild:${player.guildId}]`, "player killed");
      player.stop();
      AutoKill.delete(player.guildId);
    }, 5000)
  );
}
function stopAutoKill(player: GuildPlayer){
  if (AutoKill.has(player.guildId)) {
    if(process.env.DEBUG) console.log(new Date(), `[guild:${player.guildId}]`, "autokill cleared");
    clearTimeout(AutoKill.get(player.guildId));
    AutoKill.delete(player.guildId);
  }
}
client.on(Events.VoiceStateUpdate, async(oldState, newState) => {
  let oldChannel = oldState.channelId;
  let newChannel = newState.channelId;
  let player = getPlayer(newState.guild.id);
  if (!player.isConnected || oldChannel == newChannel) {
    return;
  }
  let connection = getVoiceConnection(newState.guild.id);
  let playerChannel = connection.joinConfig.channelId;
  if(oldChannel == playerChannel && newChannel != playerChannel){
    if(newState.member.id == client.user.id){
      if (newChannel == null){
        stopAutoKill(player);
        player.stop();
        return;
      }
      player.join(newState.channel);
      return;
    }
    if(oldState.channel.members.size == 1){
      startAutoKill(player);
    }
  }
  if(newChannel == playerChannel){
    if(newState.channel.members.size == 1){
      startAutoKill(player);
    } else {
      stopAutoKill(player);
    }
  }
});

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (
    interaction: ChatInputCommandInteraction<CacheType>
  ) => Promise<Message<boolean>>;
}

const commands: Collection<string, BotCommand> = new Collection();

export interface WebRouteParam {
  [name: string]: any;
}
export abstract class WebRoute {
  readonly name: string;
  readonly path: string = "";
  readonly router: Router;
}

function isWebRoute(obj: object): obj is WebRoute{
  return (obj as WebRoute).router !== undefined;
}

const routes: Collection<string, WebRoute> = new Collection();


let deployer: CommandDeploy;
(async ()=>{
  await loadTranslations();
  console.log(new Date(), `Loaded ${getTranslationList().length} languages`);
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") && !file.startsWith("!"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(filePath)) as BotCommand;

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      commands.set(command.data.name, command);
    } else {
      console.log(
        new Date(),
        `[WARNING] The command at ${filePath} is missing a required property.`
      );
    }
  }
  console.log(new Date(), `Loaded ${commands.size} commands`);
  let JsonCommands = commands.map((cmd) => cmd.data.toJSON());
  deployer = new CommandDeploy(JsonCommands);

  const routesPath = path.join(__dirname, "routes");
  const routeFiles = fs
    .readdirSync(routesPath)
    .filter((file) => file.endsWith(".js") && !file.startsWith("!"));
  for (const file of routeFiles) {
    const filePath = path.join(routesPath, file);
    const route = await import(filePath);

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (isWebRoute(route)) {
      routes.set(route.name, route);
      web.use("/",route.router);
    } else {
      console.log(
        new Date(),
        `[WARNING] The route at ${filePath} is missing a required property.`
      );
    }
  }
  web.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error(err.stack);
    res.status(500).send("Something broke!");
  });
  console.log(new Date(), `Loaded ${routes.size} web routes`);
})();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return await interaction.reply({
      content: `No command matching \`/${interaction.commandName}\` was found. If you are reading this: something is seriously broken :(`,
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(new Date(), `Error executing command ${interaction.commandName}`);
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command! Report this to the developer if the problem persists.",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command! Report this to the developer if the problem persists.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
const server = web.listen(process.env.PORT, () => {
  console.log(
    new Date(),
    "HTTP/Socket server is listening on port",
    (server.address() as AddressInfo).port
  );
});

// proccess console commands
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", function (text: string) {
  const full = text.trim();
  const command = full.split(" ")[0].toLowerCase();
  const args = full.split(" ").slice(1);
  switch (command) {
    case "quit":
      quit();
      break;
    case "deploy":
      const deployTarget = (args.length == 0 ? "server" : args[0]).toLowerCase();
      if (deployTarget == "server") {
        deployer.serverDeploy(
          args.length > 1 && args[1].toLowerCase() == "clear"
        );
      } else {
        deployer.globalDeploy(
          args.length > 1 && args[1].toLowerCase() == "clear"
        );
      }
      break;
    case "active":
      console.log(
          new Date(),
          `There are ${getPlayerCount()} active guild players`
      );
      getActivePlayers().forEach(p => {
        let guild = client.guilds.cache.get(p.guildId);
        console.log(`- ${guild.name} (${p.guildId})`);
      });
      break;
    case "resync":
      if(args.length == 0){
        console.log(new Date(), "Available arguments: 'track', 'playlist'");
        break;
      }
      const syncTarget = args[0].toLowerCase();
      switch(syncTarget){
        case "track":
          Track.sync({ alter:true });
          console.log(new Date(), "Track resync complete!");
          break;
        case "playlist":
          Playlist.sync({ alter: true });
          console.log(new Date(), "Playlist resync complete!");
          break;
        default:
          console.log(
            new Date(),
            `Unknown argument '${syncTarget}'`
          );
          break;
      }
      break;
    default:
      console.log(new Date(), "Unknown command: " + command);
      break;
  }
});

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', function(error, origin){
  console.log(new Date(),"An uncaught exception occurred:", error.message);
  console.log(error);
  quit(1);
});

function exitHandler(options: {cleanup?: boolean, exit?: boolean}, exitCode: number) {
  if (options.cleanup) console.log('clean');
  if (exitCode || exitCode === 0) console.log("Exiting with code:",exitCode);
  if (options.exit) quit();
}

async function quit(exitCode = 0) {
  console.log(new Date(),"Shutting down...");
  await client.destroy();
  await sequelize.close();
  server.close();

  
  console.log(new Date(),"Exiting process...");
  process.exit(exitCode);
}