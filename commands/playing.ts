import { CacheType, ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.playing.description");
let description_locale = filter(description, (v) => {
	const enumValues = Object.values(Locale) as string[];
	return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

export = {
	data: new SlashCommandBuilder()
		.setName('playing')
		.setDescription(description['en'])
		.setDescriptionLocalizations(description_locale)
        .setContexts([InteractionContextType.Guild]),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const lang = getTranslation(interaction.locale);
		
		let player = getPlayer(interaction.guild.id);
		if (!player.currentTrack) {
			return interaction.followUp(lang.messages.player_not_playing);
		}
		let metadata = player.currentTrack.metadata;
		let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : " ";
		const embed = new EmbedBuilder()
			.setColor([25, 225, 25])
			.setTitle(lang.commands.playing.title)
			.addFields({
				name: `${metadata.title}`,
				value: `${append}`
			})
			.addFields(
				{name: lang.commands.playing.playtime, value:`${player.formatTime(player.playTime)}`, inline:true},
				{name: lang.commands.playing.duration, value:`${player.formatTime(player.duration)}`, inline:true},
			)
			.setTimestamp();
		if(metadata.thumbnail){
			embed.setThumbnail(`https://${process.env.DOMAIN}/thumb/${player.currentTrack.id}`);
		}
		return interaction.followUp({embeds: [embed]});
	},
};