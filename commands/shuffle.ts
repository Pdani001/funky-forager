import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.shuffle.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

export = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription(description['en'])
        .setDescriptionLocalizations(description_locale)
        .setContexts([InteractionContextType.Guild]),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
        // let's defer the interaction as things can take time to process
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const lang = getTranslation(interaction.locale);
        
        const channel = (interaction.member as GuildMember).voice.channel;
        if (!channel)
            return interaction.followUp(lang.messages.user_not_connected);
    
        let player = getPlayer(interaction.guild.id);
        player.shuffle = !player.shuffle;
        return interaction.followUp(
          util.format(
            lang.commands.shuffle.change.message,
            player.shuffle
              ? lang.commands.shuffle.change.enabled
              : lang.commands.shuffle.change.disabled
          )
        );
	},
};