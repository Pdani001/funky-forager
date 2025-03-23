import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { BaseGuildVoiceChannel, Collection } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import youtubedl, { Payload } from "youtube-dl-exec";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import {path as ffmpegPath} from "@ffmpeg-installer/ffmpeg";
import {path as ffprobePath} from "@ffprobe-installer/ffprobe";
import stream from "stream";
import { EventEmitter } from "node:events";
import { getPlaylist, getTrack, getTrackId, Playlist, Track, TrackMetadata } from "./Track";
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const players: Collection<string, GuildPlayer> = new Collection();
const DownloadQueue: Collection<string, EventEmitter<DownloadEvent>> = new Collection();


const cookies = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".txt") && file.startsWith("cookies"));
function cookieFile(): string {
  if(cookies.length == 0)
    return "";
  let rng = crypto.randomInt(cookies.length);
  return cookies[rng];
}

export function getPlayerCount(): number {
  return getActivePlayers().length;
}

export function getActivePlayers(): GuildPlayer[] {
  return players.filter(p=>p.isConnected).map(p=>p);
}

interface DownloadEvent {
  download: [hash: string, error?: any];
}
export enum PlayerLoopMode {
  Off = 0,
  Track = 1,
  Queue = 2
}
export interface PlayerEvent {
  QueueTrackAdded: [track: Track];
  QueueTracksAdded: [tracks: Track[]];
  QueueTrackRemoved: [track: Track, index?: number];
  QueueTracksRemoved: [track: Track[], index?: number[]];
  TrackStarted: [track: Track, index?: number];
  TrackFinished: [track: Track];
  PlayerConnected: [channel: string];
  PlayerStopped: [];
}
export function getPlayer(guildId: string): GuildPlayer
{
    if(!players.has(guildId)){
        players.set(guildId, new GuildPlayerImpl(guildId));
    }
    return players.get(guildId);
}
interface PlayerTrack {
  readonly track: Track;
  readonly playlist?: Playlist;
}
export interface GuildPlayer extends EventEmitter<PlayerEvent> {
  volume: number;
  shuffle: boolean;
  paused: boolean;
  loop: PlayerLoopMode;
  readonly guildId: string;
  readonly isConnected: boolean;
  readonly queue: Track[];
  readonly currentTrack?: Track;
  readonly playTime: number;
  readonly duration: number;
  seek(time: number): void;
  join(channel: BaseGuildVoiceChannel): Promise<VoiceConnection>;
  playSong(
    channel: BaseGuildVoiceChannel,
    query: string | Track | Playlist
  ): Promise<PlayerTrack>;
  queueSong(
    channel: BaseGuildVoiceChannel,
    query: string | Track | Playlist
  ): Promise<Track | Playlist>;
  removeSong(...track: Track[]): boolean;
  removeSongAt(...index: number[]): boolean;
  skipSong(): void;
  stop(): void;
  formatTime(ms: number): string;
}

class TrackMetadataImpl implements TrackMetadata {
  title: string;
  author?: string;
  duration: number;
  thumbnail?: string;
  live?: boolean;
}
import crypto from "crypto";
class GuildPlayerImpl extends EventEmitter<PlayerEvent> implements GuildPlayer {
  private readonly _guildId: string;
  get guildId(): string {
    return this._guildId;
  }
  _volume: number = 20;
  get volume(): number {
    return this._volume;
  }
  set volume(value: number) {
    if (value > 100) value = 100;
    if (value < 0) value = 0;
    this._volume = value;
    if (this._player.state.status != AudioPlayerStatus.Idle) {
      this._player.state.resource.volume.setVolumeLogarithmic(
        this._volume / 100.0
      );
    }
  }

  get playTime(): number {
    if (this._player.state.status != AudioPlayerStatus.Idle)
      return this._player.state.resource.playbackDuration;
    return 0;
  }
  get duration(): number {
    if (this._playing) return this._playing.metadata.duration;
    return 0;
  }

  _history: Track[] = [];

  _queue: Track[] = [];

  get queue(): Track[] {
    return this._queue;
  }

  shuffle: boolean = false;
  loop: PlayerLoopMode = PlayerLoopMode.Off;

  private _workingDir: string;
  private _playing: Track;

  get currentTrack(): Track {
    return this._playing;
  }

  constructor(guildId: string) {
    super();
    this._guildId = guildId;
    this._player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    this._player.on(AudioPlayerStatus.Idle, () => {
      if (!this._currentChannel) return;
      if (this.loop == PlayerLoopMode.Track && this._playing) {
        this.emit("TrackStarted", this._playing);
        this.play(this._playing);
        //this.playSong(this._currentChannel, this._playing);
        return;
      }
      if (this.loop == PlayerLoopMode.Queue && this._playing) {
        this.queue.push(this._playing);
      }
      this._history.unshift(this._playing);
      this.emit("TrackFinished", this._playing);
      if (this._queue.length > 0) {
        let track: Track;
        let trackIndex: number = 0;
        if (this.shuffle) {
          trackIndex = crypto.randomInt(this._queue.length);
          track = this._queue[trackIndex];
          this._queue.splice(trackIndex, 1);
        } else {
          track = this._queue.shift();
        }
        this._playing = track;
        this.emit("TrackStarted", track, trackIndex);
        this.play(track);
        //this.playSong(this._currentChannel, track);
      } else {
        this._playing = null;
      }
    });
    this._player.on("error", (error) => {
      console.log(
        new Date(),
        `[guild:${this._guildId}]`,
        "Encountered a Player error"
      );
      console.log(error);
      this._history.unshift(this._playing);
      if (this._queue.length > 0) {
        let track: Track;
        let trackIndex: number = 0;
        if (this.shuffle) {
          trackIndex = crypto.randomInt(this._queue.length);
          track = this._queue[trackIndex];
          this._queue.splice(trackIndex, 1);
        } else {
          track = this._queue.shift();
        }
        this._playing = track;
        this.emit("TrackStarted", track, trackIndex);
        this.play(track);
        //this.playSong(this._currentChannel, track);
      } else {
        this._playing = null;
      }
    });

    this._workingDir = path.join(__dirname, "files");
  }
  seek(time: number): void {
    if(this._playing){
      this.play(this._playing,time/1000);
    }
  }

  private readonly _player: AudioPlayer;
  get isConnected(): boolean {
    return getVoiceConnection(this._guildId) != undefined;
  }
  get paused(): boolean {
    return (
      this._player.state.status != AudioPlayerStatus.Playing &&
      this._player.state.status != AudioPlayerStatus.Buffering
    );
  }
  set paused(value) {
    if (value) this._player.pause();
    else this._player.unpause();
  }
  private convert(read: stream.Readable, trackId: string) {
    return new Promise<string>((resolve, reject) => {
      let music_file = path.join(this._workingDir, trackId + ".mp3");
      let hash = crypto.createHash("md5");
      read.on("data",(data)=>{
        hash.update(data);
      });
      ffmpeg(read)
        .toFormat("mp3")
        .saveToFile(music_file)
        .on("end", () => {
          resolve(hash.digest("hex"));
        })
        .on("error", (err) => {
          return reject(err);
        });
    });
  }
  private getDuration(music_file: string) {
    return new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(music_file, (err, metadata) => {
        if (err) {
          reject(err);
        }
        resolve(metadata.format.duration);
      });
    });
  }

  private read(track: Track, seek?: number) {
    if(!seek)
      seek = 0;
    let _pipe = new stream.PassThrough();
    if(track.metadata.live){
      const cmd = youtubedl.exec(track.query, {
        output: "-",
        addHeader: ["referer:youtube.com", "user-agent:googlebot"],
        preferFreeFormats: true,
        cookies: cookieFile(),
      });
      cmd.stdout.pipe(_pipe, { end: true });
      return _pipe;
    }
    let music_file = path.join(this._workingDir, track.id + ".mp3");
    let _stream = fs.createReadStream(music_file);
    _stream.on("error", () => {});
    let seeker = ffmpeg(_stream);
    seeker.format("mp3").setStartTime(seek).pipe(_pipe);
    seeker.on("error",()=>{
      _stream.destroy();
      _pipe.destroy();
    });
    return _pipe;
  }

  formatTime(ms: number): string {
    let minus = false;
    if (ms < 0) {
      minus = true;
      ms = -ms;
    }
    const time = {
      day: Math.floor(ms / 86400000),
      hour: Math.floor(ms / 3600000) % 24,
      minute: Math.floor(ms / 60000) % 60,
      second: Math.floor(ms / 1000) % 60,
    };
    const alwaysShow = ["second", "minute"];
    return (
      (minus ? "-" : "") +
      Object.entries(time)
        .filter(([key, val]) => {
          return val !== 0 || alwaysShow.includes(key);
        })
        .map(([key, val]) => `${val}`.padStart(2, "0"))
        .join(":")
    );
  }

  join(channel: BaseGuildVoiceChannel) {
    return new Promise<VoiceConnection>(async (resolve, reject) => {
      if (channel == null) {
        return reject(new TypeError("channel is not set"));
      }
      let connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });
      this._currentChannel = channel;
      this.emit("PlayerConnected", channel.id);
      connection.on(
        VoiceConnectionStatus.Disconnected,
        async (oldState, newState) => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Seems to be reconnecting to a new channel - ignore disconnect
          } catch {
            // Seems to be a real disconnect which SHOULDN'T be recovered from
            this.stop();
          }
        }
      );
      connection.subscribe(this._player);
      return resolve(connection);
    });
  }

  private async download(query: string, trackId: string) {
    return new Promise<string>(async (resolve, reject) => {
      let music_file = path.join(this._workingDir, trackId + ".mp3");
      const file_exists = fs.existsSync(music_file);
      if (file_exists) {
        resolve(null);
      }
      if (DownloadQueue.has(trackId)) {
        DownloadQueue.get(trackId).once("download", (hash, error) => {
          if (error) return reject(error);
          return resolve(hash);
        });
        return;
      }
      let event = new EventEmitter<DownloadEvent>();
      DownloadQueue.set(trackId, event);
      let video_file = path.join(this._workingDir, trackId + ".mp4");
      let thumb_file = path.join(this._workingDir, trackId + ".png");

      try {
        await youtubedl(query, {
          addHeader: ["referer:youtube.com", "user-agent:googlebot"],
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true,
          cookies: cookieFile(),
          noPlaylist: true,
          matchFilter: "!is_live",
          output: video_file,
          writeThumbnail: true,
        });
      } catch (e) {
        event.emit("download", null, e);
        console.log(new Date(), `[guild:${this._guildId}]`, "Download failed");
        return reject(e);
      }

      const file_list = fs.readdirSync(this._workingDir).filter((file) => {
        return file.startsWith(trackId) && !file.endsWith(".mp4");
      });
      if(file_list.length > 0){
        fs.renameSync(path.join(this._workingDir, file_list[0]), thumb_file);
      }

      let hash: string;
      try {
        hash = await this.convert(fs.createReadStream(video_file), trackId);
      } catch (e) {
        console.log(new Date(), `[guild:${this._guildId}]`, "Convert failed");
        event.emit("download", null, e);
        return reject(e);
      } finally {
        fs.unlinkSync(video_file);
      }

      event.emit("download", hash);
      setTimeout(() => {
        DownloadQueue.delete(trackId);
      }, 5000);
      resolve(hash);
    });
  }

  private async getHash(music_file: string) {
    return new Promise<string>(async (resolve, reject) => {
      let hash = crypto.createHash("md5");
      fs.createReadStream(music_file)
        .on("data",(data)=>{
          hash.update(data);
        })
        .on("end", () => {
          resolve(hash.digest("hex"));
        })
        .on("error", (err)=>{
          reject(err);
        });
    });
  }

  loadTrack(payload: Payload, trackId?: string, query?: string) {
    return new Promise<Track>(async (resolve, reject) => {
      if (trackId) {
        let track = await getTrack(trackId);
        if (track.length == 1) return resolve(track[0]);
      }

      if (!query) {
        try {
          payload = (await youtubedl(payload["url"], {
            addHeader: ["referer:youtube.com", "user-agent:googlebot"],
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            cookies: cookieFile(),
            dumpSingleJson: true,
            skipDownload: true,
            noPlaylist: true,
          })) as Payload;
        } catch (e) {
          console.log(
            new Date(),
            `[guild:${this._guildId}]`,
            `Failed to resolve playlist track '${payload["url"]}'`
          );
          return reject(e);
        }
        trackId = `${payload.id}@${payload.webpage_url_domain}`;
        query = payload.webpage_url;
      }

      let metadata = new TrackMetadataImpl();
      metadata.title = payload.title;
      metadata.author = payload.channel ?? payload.uploader;
      metadata.live = payload.is_live || payload.duration === undefined;
      let music_file = path.join(this._workingDir, trackId + ".mp3");
      
      const music_exists = fs.existsSync(music_file);
      
      let file_hash: string;
      if (!music_exists && !metadata.live) {
        try {
          file_hash = await this.download(query, trackId);
        } catch (e) {
          console.log(
            new Date(),
            `[guild:${this._guildId}]`,
            "Aborting playback following failed download"
          );
          return reject(e);
        }
      } else {
        file_hash = !metadata.live ? await this.getHash(music_file) : crypto.createHash("md5").update(crypto.randomUUID()).digest("hex");
      }
      let thumb_file = path.join(this._workingDir, trackId + ".png");
      const thumb_exists = fs.existsSync(thumb_file);
      if(thumb_exists){
        metadata.thumbnail = thumb_file;
      }
      metadata.duration = 0;
      if(music_exists){
        try {
          let duration = await this.getDuration(music_file);
          metadata.duration = Math.trunc(duration * 1000);
        } catch (e) {
          console.log(
            new Date(),
            `[guild:${this._guildId}]`,
            `getDuration failed for '${music_file}'`
          );
          return reject(e);
        }
      }
      let track = new Track({ query, id: trackId, metadata, hash: file_hash });
      await track.save();
      return resolve(track);
    });
  }

  loadPlaylist(payload: Payload, query?: string) {
    return new Promise<Playlist>(async (resolve, reject) => {
      let entries = payload["entries"] as Payload[];
      let tracks: Track[];
      const domain = payload.webpage_url_domain;
      tracks = (await Promise.all(
        entries.map(async (value) => {
          try {
            let track = await this.loadTrack(value, `${value.id}@${domain}`);
            return track;
          } catch(e){
            return null;
          }
        })
      ))
      .filter((t)=>t!=null);
      if(tracks.length == 0){
        reject(new Error("failed to resolve tracks in playlist"));
      }
      if (!query) {
        query = payload.webpage_url;
      }
      let playlistId = `${payload.id}@${payload.webpage_url_domain}`;
      let playlist = new Playlist({
        query,
        id: playlistId,
        title: payload.title,
        tracks,
      });
      playlist.save();
      return resolve(playlist);
    });
  }

  resolveQuery(query: string) {
    return new Promise<Track | Playlist>(async (resolve, reject) => {
      let trackId = await getTrackId(query);
      if (trackId) {
        let track = await getTrack(trackId);
        if (track.length == 1) {
          track[0].query = query;
          return resolve(track[0]);
        }
        let playlist = await getPlaylist(trackId);
        if (playlist){
          playlist.query = query;
          return resolve(playlist);
        }
      }
      try {
        new URL(query);
      } catch (e) {
        return reject(e);
      }
      if (process.env.DEBUG)
        console.log(new Date(), `[guild:${this._guildId}]`, "payload start");
      let payload: Payload;
      try {
        payload = (await youtubedl(query, {
          addHeader: ["referer:youtube.com", "user-agent:googlebot"],
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true,
          cookies: cookieFile(),
          dumpSingleJson: true,
          skipDownload: true,
          flatPlaylist: true,
        })) as Payload;
      } catch (e) {
        console.log(
          new Date(),
          `[guild:${this._guildId}]`,
          `Failed to resolve query '${query}'`
        );
        return reject(e);
      }
      if (process.env.DEBUG)
        console.log(new Date(), `[guild:${this._guildId}]`, "payload end");
      if (payload._type == "playlist") {
        try {
          let playlist = await this.loadPlaylist(payload);
          return resolve(playlist);
        } catch (e) {
          return reject(e);
        }
      }
      try {
        trackId = `${payload.id}@${payload.webpage_url_domain}`;
        let track = await this.loadTrack(payload, trackId, query);
        return resolve(track);
      } catch (e) {
        return reject(e);
      }
    });
  }

  private _currentChannel: BaseGuildVoiceChannel;

  queueSong(channel: BaseGuildVoiceChannel, query: string | Track | Playlist) {
    return new Promise<Track | Playlist>(async (resolve, reject) => {
      let result: Track | Playlist;
      try {
        result =
          typeof query === "string" ? await this.resolveQuery(query) : query;
      } catch (e) {
        return reject(e);
      }
      if (!channel && this._currentChannel) {
        channel = this._currentChannel;
      }
      if (result instanceof Track) {
        this._queue.push(result);
        this.emit("QueueTrackAdded", result);
      } else {
        let tracks = await result.tracks;
        this._queue.push(...tracks);
        this.emit("QueueTracksAdded", tracks);
      }
      if (
        this._player.state.status == AudioPlayerStatus.Idle &&
        channel != null
      ) {
        try {
          let track: Track;
          if (this.shuffle) {
            let index = crypto.randomInt(this._queue.length);
            track = this._queue[index];
            this._queue.splice(index, 1);
          } else {
            track = this._queue.shift();
          }
          this.playSong(channel, track);
        } catch (e) {
          return reject(e);
        }
      }
      return resolve(result);
    });
  }

  playSong(channel: BaseGuildVoiceChannel, query: string | Track | Playlist) {
    return new Promise<PlayerTrack>(async (resolve, reject) => {
      if (!channel && !this._currentChannel) {
        return reject(new TypeError("channel is not set"));
      }
      if (!channel) {
        channel = this._currentChannel;
      }

      let payload: Track | Playlist;
      try {
        payload =
          typeof query === "string" ? await this.resolveQuery(query) : query;
      } catch (e) {
        return reject(e);
      }
      let playlist: Playlist;
      let track: Track;
      let trackIndex: number = 0;
      if (payload instanceof Track) {
        track = payload;
      } else {
        playlist = payload;
        let tracks = await payload.tracks;
        this.emit(
          "QueueTracksRemoved",
          this._queue,
          Array.from(Array(this._queue.length).keys())
        );
        this._queue = [];
        this._queue.push(...tracks);
        this.emit("QueueTracksAdded", tracks);
        if (this.shuffle) {
          trackIndex = crypto.randomInt(this._queue.length);
          track = this._queue[trackIndex];
          this._queue.splice(trackIndex, 1);
        } else {
          track = this._queue.shift();
        }
      }

      let connection = getVoiceConnection(channel.guild.id);

      if (!connection) {
        connection = await this.join(channel);
      } else {
        if (this._player.state.status != AudioPlayerStatus.Idle) {
          this._player.stop();
        }
        if (connection.joinConfig.channelId != channel.id) {
          connection = await this.join(channel);
        }
      }

      this.emit("TrackStarted", track, trackIndex);
      this._playing = track;

      this.play(track);

      return resolve({
        track: track,
        playlist: playlist ?? null,
      });
    });
  }

  private play(track: Track, seek?: number){
    if(track.metadata.duration <= seek){
      this.skipSong();
      return;
    }
    let _stream = this.read(track, seek);

    let resource = createAudioResource(_stream, {
      inlineVolume: true,
      metadata: track.metadata,
    });

    resource.volume.setVolumeLogarithmic(this._volume / 100.0);
    this._player.play(resource);
  }

  removeSong(...tracks: Track[]): boolean {
    let removed: Track[] = [];
    let indexes: number[] = [];
    if (tracks.length == 0) return false;
    for (let track of tracks) {
      let index = this._queue.findIndex((search) => {
        return search.id == track.id;
      });
      if (index < 0) return false;
      while (index >= 0) {
        indexes.push(index);
        removed.push(...this._queue.splice(index, 1));
        index = this._queue.findIndex((search) => {
          return search.id == track.id;
        });
      }
    }
    if (removed.length == 1) {
      this.emit("QueueTrackRemoved", removed[0]);
    } else {
      this.emit("QueueTracksRemoved", removed, indexes);
    }
    return true;
  }

  removeSongAt(...index: number[]): boolean {
    let removed: Track[] = [];
    if (index.length == 0) return false;
    index = index
      .filter((i) => this._queue.length < i && i >= 0)
      .sort((a, b) => b - a);
    for (let i of index) {
      removed.push(...this._queue.splice(i, 1));
    }
    if (removed.length == 1) {
      this.emit("QueueTrackRemoved", removed[0]);
    } else {
      this.emit("QueueTracksRemoved", removed);
    }
    return true;
  }

  skipSong(): void {
    this._player.stop();
  }

  stop(): void {
    if (this._playing) this._history.unshift(this._playing);
    this._currentChannel = null;
    this._queue = [];
    this._playing = null;
    this._player.stop(true);
    let connection = getVoiceConnection(this._guildId);
    if (!connection) return;
    connection.destroy();
    this.emit("PlayerStopped");
  }
}