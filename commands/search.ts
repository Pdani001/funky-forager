import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CacheType, ChatInputCommandInteraction, ComponentType, EmbedBuilder, GuildMember, InteractionContextType, Locale, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../GuildPlayer';
import { getTranslation, getLocalizations } from '../lang';
import { filter, slice } from '../filter';
import util from "util";
import { Track } from '../Track';
import sequelize from '../DataManager';

let description = getLocalizations("commands.search.description");
let description_locale = filter(description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
//const lang = getLang(interaction.locale);

let option_name = getLocalizations("commands.search.option.name");
let option_name_locale = filter(option_name, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});
let option_description = getLocalizations("commands.search.option.description");
let option_description_locale = filter(option_description, (v) => {
  const enumValues = Object.values(Locale) as string[];
  return enumValues.includes(v[0]);
});

export = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription(description["en"])
    .setDescriptionLocalizations(description_locale)
    .addStringOption((option) =>
      option
        .setName(option_name["en"])
        .setNameLocalizations(option_name_locale)
        .setDescription(option_description["en"])
        .setDescriptionLocalizations(option_description_locale)
        .setMinLength(2)
        .setRequired(true)
    )
    .setContexts([InteractionContextType.Guild]),
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    // let's defer the interaction as things can take time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const lang = getTranslation(interaction.locale);

    const channel = (interaction.member as GuildMember).voice.channel;
    let withResponse = true;
    if (!channel) withResponse = false;

    let player = getPlayer(interaction.guild.id);
    let search = interaction.options.getString(option_name["en"], true);
    let result = await sequelize.query(
      `SELECT * FROM \`tracks\` WHERE LOWER(JSON_VALUE(\`metadata\`, '$.title')) LIKE LOWER(${sequelize.escape(`%${search}%`)}) LIMIT 5;`,
      {
        model: Track,
        mapToModel: true,
        // bind: [search]
      }
    );
    /* let where = sequelize.where(
      sequelize.fn(
        "LOWER",
        sequelize.fn("JSON_VALUE", sequelize.col("metadata"), "$.title")
      ),
      Op.like,
      `%$1%`
    );
    console.log(where);
    let result = await Track.findAll({
      where,
      bind: [search.toLowerCase()],
    }); */
    if(result.length == 0){
      return interaction.followUp(lang.commands.search.no_result);
    }
    const row = new ActionRowBuilder<ButtonBuilder>();
    const embed = new EmbedBuilder()
      .setColor([214, 167, 56])
      .setTitle(lang.commands.search.title)
      .setTimestamp();
    for(let i = 0; i < result.length; i++){
      let metadata = result[i].metadata;
      let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : ' ';
      embed.addFields({
        name: `${i + 1}. ${slice(metadata.title, 200)}`,
        value: `${append}`,
      });
      if(withResponse){
        const button = new ButtonBuilder()
          .setCustomId(`${i}`)
          .setLabel(`${i + 1}`)
          .setStyle(ButtonStyle.Secondary);
        row.addComponents(button);
      }
    }
    let response = interaction.followUp({
      embeds: [embed],
      components: withResponse ? [row] : [],
      withResponse
    });
    if(!withResponse)
      return;
    const message = await response;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3_600_000,
    });
    collector.on("collect", async (btn) => {
      await btn.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await btn.update({
          components: []
        });
      } catch {}
      let i = parseInt(btn.customId);
      let track = result[i];
      try {
          let song = await player.playSong(channel, track);
          let metadata = song.track.metadata;
          let append = metadata.author ? util.format(lang.messages.track_author,metadata.author) : '';
          append += song.playlist ? util.format(lang.messages.track_playlist,song.playlist.title) : '';
          return btn.followUp({
            content: `${util.format(lang.messages.track_started,metadata.title)}${append}`,
            flags: MessageFlags.Ephemeral
          });
      } catch (e) {
          console.log("%s", new Date(), `[guild:${player.guildId}]`, "Search Playback failed", e);
          return btn.followUp({
            content: util.format(lang.messages.error,e),
            flags: MessageFlags.Ephemeral
          });
      }
    });
  },
};