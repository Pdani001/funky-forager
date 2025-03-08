import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter, slice } from '../filter';
import util from "util";

let description = getLocalizations("commands.playlist.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

export = {
	data: new SlashCommandBuilder()
		.setName('playlist')
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
        if(player.queue.length == 0){
            return interaction.followUp(lang.commands.playlist.empty);
        }

        const embed = new EmbedBuilder()
          .setColor([0, 153, 255])
          .setTitle(lang.commands.playlist.title)
          .setTimestamp();

        let limit = 10;
        
        if(player.queue.length > limit){
            for(let i = 0; i < limit; i++){
                let track = player.queue[i];
                let metadata = track.metadata;
                let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : ' ';
                embed.addFields({
                  name: `${i + 1}. ${slice(metadata.title, 200)}`,
                  value: `${append}`,
                  
                });
            }
            embed.setFooter({
              text: util.format(lang.commands.playlist.footer,player.queue.length-limit)
            });
        } else {
            let i = 1;
            for (let track of player.queue) {
              let metadata = track.metadata;
              let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : " ";
              embed.addFields({
                name: `${i++}. ${slice(metadata.title, 200)}`,
                value: `${append}`,
              });
            }
        }
        return interaction.followUp({embeds: [embed]});
	},
};