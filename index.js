const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();

// إعدادات CORS للسماح بالطلبات المتخطية لصفحة التحذير
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'bypass-tunnel-reminder']
}));

app.use(express.json());

// تشخيص أولي للتوكن قبل البدء
async function validateToken(token) {
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${token}` }
        });
        const text = await response.text();
        if (response.ok) {
            try {
                const data = JSON.parse(text);
                console.log(`✅ Token is valid! Bot Name: ${data.username}`);
                return true;
            } catch (e) {
                console.error('❌ Failed to parse response as JSON:', text.substring(0, 100));
                return false;
            }
        } else {
            console.error(`❌ Token Validation Failed (Status ${response.status}):`, text.substring(0, 100));
            return false;
        }
    } catch (err) {
        console.error('❌ Network error during token validation:', err);
        return false;
    }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// استخدام Token من متغيرات البيئة (Environment Variables) حصرياً للأمان
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('❌ Error: DISCORD_TOKEN is not defined in Environment Variables!');
    // سنترك السيرفر يعمل لكي لا يظهر خطأ في Render، لكن البوت لن يتصل
}
const CHANNEL_ID = "1483207784962064458";
const ROLE_ID = "1483115535632695318";

app.post('/apply', async (req, res) => {
  const { userId, username, character_name, real_name, char_age, real_age, story } = req.body;

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle("📩 طلب جديد - Oryan RP")
      .setColor('#f82500')
      .addFields(
        { name: "👤 اسم الشخصية", value: character_name || 'N/A' },
        { name: "🧑 الاسم الحقيقي", value: real_name || 'N/A' },
        { name: "🎂 عمر الشخصية", value: char_age || 'N/A' },
        { name: "📅 العمر الحقيقي", value: real_age || 'N/A' },
        { name: "📖 القصة", value: story || 'N/A' }
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
  } catch (error) {
    console.error('Error sending application:', error);
    res.status(500).send({ status: "error", message: error.message });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split("_");
  
  try {
    const user = await client.users.fetch(userId);

    if (action === "accept") {
      const guild = interaction.guild;
      const member = await guild.members.fetch(userId).catch(() => null);
      
      let roleStatus = "";
      if (member) {
        await member.roles.add(ROLE_ID);
        roleStatus = "\n✅ تم تسليم الرتبة تلقائياً";
      } else {
        roleStatus = "\n⚠️ تعذر العثور على العضو في السيرفر";
      }

      await user.send(`✅ تم قبولك في Oryan RP! توجه إلى روم الانتظار.${member ? "\nتم منحك رتبة المواطن تلقائياً." : ""}`).catch(console.error);
      
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setFooter({ text: `✅ الحالة: Accepted بواسطة ${interaction.user.username}${roleStatus}` });
      
      await interaction.update({ embeds: [embed], components: [] });
    }

    if (action === "reject") {
      await user.send("❌ نأسف، تم رفض طلب التقديم الخاص بك في Oryan RP.").catch(console.error);
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setFooter({ text: `❌ الحالة: Rejected بواسطة ${interaction.user.username}` });
      await interaction.update({ embeds: [embed], components: [] });
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
        await interaction.reply({ content: "حدث خطأ أثناء معالجة الطلب.", ephemeral: true });
    }
  }
});

client.on('ready', () => {
    console.log(`✅ Success: Logged in as ${client.user.tag}!`);
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.on('warn', (info) => {
    console.warn('⚠️ Discord Warning:', info);
});

client.on('shardReady', (id) => {
    console.log(`💎 Shard ${id} is ready!`);
});

client.on('shardDisconnect', (event, id) => {
    console.log(`🔌 Shard ${id} disconnected! Code: ${event.code}`);
});

client.on('debug', (info) => {
    // تقليل الضجيج قليلاً مع الحفاظ على المهم
    if (info.includes('Heartbeat') || info.includes('Latency')) return;
    console.log('🔍 Discord Debug:', info);
});

console.log('⏳ Attempting to login to Discord...');

async function startBot() {
    if (!TOKEN) {
        console.error('❌ Error: DISCORD_TOKEN is not defined!');
        return;
    }

    const isValid = await validateToken(TOKEN);
    if (!isValid) {
        console.warn('⚠️ Warning: Token validation was not successful, but attempting login anyway...');
    }

    client.login(TOKEN).catch(err => {
        console.error('❌ Failed to login to Discord:', err);
    });
}

startBot();

// تشغيل السيرفر ودعم المنفذ الديناميكي لـ Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bot API is running on port ${PORT}`);
});