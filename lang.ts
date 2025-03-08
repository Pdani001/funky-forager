import fs from "node:fs";
import path from "node:path";

let list: Translation[] = [];
export function getTranslationList(): Translation[] {
    return list;
}
export async function loadTranslations() {
  const langsPath = path.join(__dirname, "lang");
  const langFiles = fs
    .readdirSync(langsPath)
    .filter((file) => file.endsWith(".json") && !file.startsWith("!"));

  for (const file of langFiles) {
    const filePath = path.join(langsPath, file);
    const lang = (await import(filePath)) as Translation;
    if(!list.find(l=>l.code==lang.code)) list.push(lang);
  }
}
export function getTranslation(code: string): Translation {
  let search = list.find((l) => l.code == code);
  if (!search) return list.find((l) => l.code == "en");
  return search;
}
export function getLocalizations(key: string): {
    [code: string]: string
} {
    let path = key.split(".");
    let final: {[code: string]: string} = {};
    for(let i = 0; i < list.length; i++){
        let lang = list[i];
        let value: {} | string | string[] = null;
        for(let k of path){
            if(value == null)
                value = lang[k];
            else
                value = value[k];
        }
        if(typeof value === "string")
            final[lang.code] = value;
    }
    return final;
}
export type Translation = {
  code: string;
  name: string;
  messages: {
    user_not_connected: string;
    player_not_connected: string;
    player_not_playing: string;
    error: string;
    track_started: string;
    track_author: string;
    track_playlist: string;
  };
  commands: {
    stop: {
      description: string;
      player_stopped: string;
    };
    volume: {
      description: string;
      option: {
        name: string;
        description: string;
      };
      volume_changed: string;
    };
    playing: {
      description: string;
      title: string;
      playtime: string;
      duration: string;
    };
    loop: {
      description: string;
      option: {
        name: string;
        description: string;
        choices: string[];
      };
      change: {
        message: string;
        state: string[];
      };
    };
    shuffle: {
      description: string;
      change: {
        message: string;
        enabled: string;
        disabled: string;
      };
    };
    skip: {
      description: string;
      message: string;
    };
    playlist: {
      description: string;
      empty: string;
      title: string;
      footer: string;
    };
    pause: {
      description: string;
      change: {
        message: string;
        paused: string;
        resumed: string;
      };
    };
    play: {
      description: string;
      option: {
        name: string;
        description: string;
      };
    };
    queue: {
      description: string;
      option: {
        name: string;
        description: string;
      };
      song: string;
      playlist: string;
    };
    bring: {
      description: string;
      switching: string;
    };
    search: {
      description: string;
      option: {
        name: string;
        description: string;
      };
      no_result: string;
      title: string;
    };
  };
};
