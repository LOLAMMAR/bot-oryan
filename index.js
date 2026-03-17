const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'bypass-tunnel-reminder']
}));
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers // مطلوب لإعطاء الرتب
  ]
});

const TOKEN = "MTQ4MzIxMjk4MzczMDcwMDQwOA.GpzCAW.gz4wsEESExagc_d9ORqS3t81wBbFk0u5APVj8c";
const CHANNEL_ID = "1483207784962064458";
const ROLE_ID = "1483115535632695318"; // ايدي الرتبة التي سيتم إعطاؤها عند القبول

app.post('/apply', async (req, res) => {
  const { userId, username, character_name, real_name, char_age, real_age, story } = req.body;

  const channel = await client.channels.fetch(CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📩 طلب جديد - Oryan RP")
    .addFields(
      { name: "👤 اسم الشخصية", value: character_name },
      { name: "🧑 الاسم الحقيقي", value: real_name },
      { name: "🎂 عمر الشخصية", value: char_age },
      { name: "📅 العمر الحقيقي", value: real_age },
      { name: "📖 القصة", value: story }
    )
    .setFooter({ text: "⏳ الحالة: Pending" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${userId}`)
      .setLabel("قبول")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_${userId}`)
      .setLabel("رفض")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [row]
  });

  res.send({ status: "ok" });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split("_");
  const user = await client.users.fetch(userId);

  if (action === "accept") {
    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(userId).catch(() => null);
      
      let roleStatus = "";
      if (member) {
        await member.roles.add(ROLE_ID);
        roleStatus = "\n✅ تم تسليم الرتبة تلقائياً";
      } else {
        roleStatus = "\n⚠️ تعذر العثور على العضو لإعطائه الرتبة";
      }

      await user.send(`✅ تم قبولك في Oryan RP! توجه إلى روم الانتظار.${member ? "\nتم منحك رتبة المواطن تلقائياً." : ""}`);
      
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setFooter({ text: `✅ الحالة: Accepted بواسطة ${interaction.user.username}${roleStatus}` });
      
      await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "حدث خطأ أثناء محاولة إعطاء الرتبة.", ephemeral: true });
    }
  }

  if (action === "reject") {
    await user.send("❌ تم رفض طلبك، قدم مرة أخرى");
    const embed = interaction.message.embeds[0];
    embed.data.footer.text = "❌ الحالة: Rejected";
    await interaction.update({ embeds: [embed], components: [] });
  }
});

client.login(TOKEN);

app.listen(3001, () => {
  console.log("API شغال");
});