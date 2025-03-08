import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.volume.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

let option_name = getLocalizations("commands.volume.option.name");
let option_name_locale = filter(option_name, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let option_description = getLocalizations("commands.volume.option.description");
let option_description_locale = filter(option_description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});

export = {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription(description['en'])
        .setDescriptionLocalizations(description_locale)
        .addIntegerOption(option=>option
            .setName(option_name['en'])
            .setNameLocalizations(option_name_locale)
            .setDescription(option_description['en'])
            .setDescriptionLocalizations(option_description_locale)
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
        )
        .setContexts([InteractionContextType.Guild]),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
        // let's defer the interaction as things can take time to process
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const lang = getTranslation(interaction.locale);
        
        const channel = (interaction.member as GuildMember).voice.channel;
        if (!channel)
            return interaction.followUp(lang.messages.user_not_connected);
    
        let player = getPlayer(interaction.guild.id);
        let volume = interaction.options.getInteger(option_name['en'], true);
        player.volume = volume;
        return interaction.followUp(util.format(lang.commands.volume.volume_changed,player.volume));
	},
};