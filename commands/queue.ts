import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { Track } from '../Track';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.queue.description");
let description_locale = filter(description, (v) => {
    const enumValues = Object.values(Locale) as string[];
    return enumValues.includes(v[0]);
});

let option_name = getLocalizations("commands.queue.option.name");
let option_name_locale = filter(option_name, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let option_description = getLocalizations("commands.queue.option.description");
let option_description_locale = filter(option_description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});

export = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription(description['en'])
        .setDescriptionLocalizations(description_locale)
        .addStringOption(option=>option
            .setName(option_name['en'])
            .setNameLocalizations(option_name_locale)
            .setDescription(option_description['en'])
            .setDescriptionLocalizations(option_description_locale)
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

        const query = interaction.options.getString(option_name['en']);

        try {
            let result = await player.queueSong(channel, query);
            if(result instanceof Track){
                let track = result.metadata;
                let append = track.author ? util.format(lang.messages.track_author,track.author) : "";
                return interaction.followUp(
                    `${util.format(lang.commands.queue.song,track.title)}${append}`
                );
            } else {
                return interaction.followUp(
                    util.format(lang.commands.queue.playlist,result.title)
                );
            }
        } catch (e) {
            console.log(new Date(), `[guild:${player.guildId}]`, "Adding to Queue failed");
            console.error(e);
            return interaction.followUp(util.format(lang.messages.error,e));
        }
	},
};