import { SlashCommandBuilder, InteractionContextType, MessageFlags, CacheType, ChatInputCommandInteraction, GuildMember, Locale, Message } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";
import { BotCommand } from '..';

let description = getLocalizations("commands.bring.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("bring")
    .setDescription(description["en"])
    .setDescriptionLocalizations(description_locale)
    .setContexts([InteractionContextType.Guild]),
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    // let's defer the interaction as things can take time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const lang = getTranslation(interaction.locale);

    const channel = (interaction.member as GuildMember).voice.channel;
    if (!channel) return interaction.followUp(lang.messages.user_not_connected);

    let player = getPlayer(interaction.guild.id);
    if (!player.isConnected) {
      return interaction.followUp(lang.messages.player_not_connected);
    }
    player.join(channel);
    return interaction.followUp(
      util.format(lang.commands.bring.switching, channel.name)
    );
  },
};

export = command;