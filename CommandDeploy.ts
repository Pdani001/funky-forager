import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
class CommandDeploy {
  #commands = [];

  constructor(commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]) {
    this.#commands = commands;
  }

  #rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  async globalDeploy(clear = false) {
    const commands = clear ? [] : this.#commands;
    try {
      if(!clear)
        console.log(new Date(), `Started refreshing ${commands.length} global application (/) commands.`);
      else
        console.log(new Date(), `Started clearing global application (/) commands.`);

      const data = await this.#rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );

      if(!clear)
        console.log(new Date(), `Successfully reloaded ${data['length']} global application (/) commands.`);
      else
        console.log(new Date(), `Successfully cleared global application (/) commands.`);
    } catch (error) {
      console.error(error);
    }
  }
  async serverDeploy(clear = false) {
    const commands = clear ? [] : this.#commands;
    try {
      if(!clear)
        console.log(new Date(), `Started refreshing ${commands.length} server application (/) commands.`);
      else
        console.log(new Date(), `Started clearing server application (/) commands.`);
  
      const data = await this.#rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.SERVER_ID),
        { body: commands },
      );
      
      if(!clear)
        console.log(new Date(), `Successfully reloaded ${data['length']} server application (/) commands.`);
      else
        console.log(new Date(), `Successfully cleared server application (/) commands.`);
    } catch (error) {
      console.error(error);
    }
  }
}
export default CommandDeploy;