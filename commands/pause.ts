import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.pause.description");
let description_locale = filter(description, (v) => {
    const enumValues = Object.values(Locale) as string[];
    return enumValues.includes(v[0]);
});

export = {
	data: new SlashCommandBuilder()
		.setName('pause')
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
        if (!player.isConnected) {
            return interaction.followUp(lang.messages.player_not_connected);
        }
        if (!player.currentTrack) {
            return interaction.followUp(lang.messages.player_not_playing);
        }
        player.paused = !player.paused;
        let message = util.format(lang.commands.pause.change.message,(player.paused ? lang.commands.pause.change.paused : lang.commands.pause.change.resumed));
        return interaction.followUp(message);
	},
};