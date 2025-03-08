import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.loop.description");
let description_locale = filter(description, (v) => {
    const enumValues = Object.values(Locale) as string[];
    return enumValues.includes(v[0]);
});

let option_name = getLocalizations("commands.loop.option.name");
let option_name_locale = filter(option_name, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let option_description = getLocalizations("commands.loop.option.description");
let option_description_locale = filter(option_description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});


let choice_off = getLocalizations("commands.loop.option.choices.0");
let choice_off_locale = filter(choice_off, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let choice_track = getLocalizations("commands.loop.option.choices.1");
let choice_track_locale = filter(choice_track, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let choice_queue = getLocalizations("commands.loop.option.choices.2");
let choice_queue_locale = filter(choice_queue, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});

export = {
	data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription(description["en"])
        .setDescriptionLocalizations(description_locale)
        .addIntegerOption((option) =>
            option
            .setName(option_name["en"])
            .setNameLocalizations(option_name_locale)
            .setDescription(option_description["en"])
            .setDescriptionLocalizations(option_description_locale)
            .setMinValue(0)
            .setMaxValue(2)
            .setRequired(true)
            .addChoices(
                {
                name: choice_off["en"],
                value: 0,
                name_localizations: choice_off_locale,
                },
                {
                name: choice_track["en"],
                value: 1,
                name_localizations: choice_track_locale,
                },
                {
                name: choice_queue["en"],
                value: 2,
                name_localizations: choice_queue_locale,
                }
            )
        )
        .setContexts([InteractionContextType.Guild]),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
        // let's defer the interaction as things can take time to process
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const lang = getTranslation(interaction.locale);
        const channel = (interaction.member as GuildMember).voice.channel;
        if (!channel)
            return interaction.followUp(lang.messages.user_not_connected);
    
        const mode = interaction.options.getInteger(option_name['en'], true);
        let player = getPlayer(interaction.guild.id);
        player.loop = mode;
        
        let message = util.format(lang.commands.loop.change.message,lang.commands.loop.change.state[mode]);
        return interaction.followUp(message);
	},
};