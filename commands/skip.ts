import { CacheType, ChatInputCommandInteraction, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter } from '../filter';
import util from "util";

let description = getLocalizations("commands.skip.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

export = {
	data: new SlashCommandBuilder()
		.setName('skip')
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
        
        player.skipSong();
        player.once("TrackStarted", function(track){
            let metadata = track.metadata;
            let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : '';
            interaction.followUp({content:`${util.format(lang.messages.track_started,metadata.title)}${append}`,flags:MessageFlags.Ephemeral});
        });
        return interaction.followUp(lang.commands.skip.message);
	},
};