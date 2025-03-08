import sequelize from "./DataManager";
import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";

export function getTrack(...id: string[]): Promise<Track[]> {
  return Track.findAll({
    where: {
      id,
    },
    order: sequelize.fn("FIELD", sequelize.col("id"), ...id)
  });
}
export function getPlaylist(id: string): Promise<Playlist> {
    return Playlist.findOne({
      where: {
        id
      }
    });
}
export class TrackUrl extends Model<
  InferAttributes<TrackUrl>,
  InferCreationAttributes<TrackUrl>
> {
  declare url: string;
  declare trackId: string;
}
export async function getTrackId(query: string): Promise<string> {
  let inst = await TrackUrl.findOne({
    where: {
      url: query
    }
  });
  return inst?.trackId;
}
export interface TrackMetadata {
    readonly title: string;
    readonly author?: string;
    readonly duration: number;
    readonly thumbnail?: string;
}
export class Track extends Model {
    declare metadata: TrackMetadata;
    declare readonly id: string;
    declare readonly hash: string;
    declare query: string;
}
Track.init(
  {
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: "({})",
      validate: {
        notEmpty: true,
      },
    },
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    hash: {
      type: DataTypes.CHAR(32),
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    query: {
      type: DataTypes.VIRTUAL
    }
  },
  { 
    sequelize,
    modelName: "tracks",
    hooks: {
        afterCreate(track) {
          TrackUrl.create({url: track.query, trackId: track.id});
        }
    },
    timestamps: false
  }
);
TrackUrl.init(
  {
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      unique: true
    },
    trackId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "trackUrls",
    timestamps: false
  }
);
export class Playlist extends Model {
  declare readonly tracks: Promise<Track[]>;
  setTracks(tracks: Track[]) {
    let _tracks = tracks.map((track) => track.id);
    this.setDataValue("tracks", _tracks);
  }
  declare readonly id: string;
  declare title: string;
  declare query: string;
}
Playlist.init(
  {
    tracks: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: "([])",
      validate: {
        notEmpty: true,
      },
      get(): Promise<Track[]> {
        return getTrack(...this.getDataValue("tracks"));
      },
      set(value: Track[]) {
        this.setTracks(value);
      },
    },
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    title: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true,
      },
    },
    query: {
      type: DataTypes.VIRTUAL
    }
  },
  {
    sequelize,
    modelName: "playlists",
    hooks: {
      afterCreate(track) {
        TrackUrl.create({ url: track.query, trackId: track.id });
      },
    },
    timestamps: false
  }
);
sequelize.sync();