const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// 🔐 Dán token bot ở đây
const token = '7670573138:AAFdGi-kqTckqJVS803ZnxCMIk1q0DLIglw';
const bot = new TelegramBot(token, { polling: true });

// 🔁 Hàm gọi API Dexscreener
async function getSolanaTokenInfo(tokenAddress) {
  const url = `https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`;
  try {
    const res = await axios.get(url);
    return res.data[0]; // Lấy phần tử đầu tiên từ mảng
  } catch (err) {
    console.error(`[Dex API Error] ${err.message}`);
    return null;
  }
}

// 🔁 Hàm gọi API Rugcheck
async function getRugCheckInfo(mint) {
  const url = `https://api.rugcheck.xyz/v1/tokens/${mint}/report`;
  try {
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error(`[RugCheck API Error] ${err.message}`);
    return null;
  }
}

// 📩 Xử lý tin nhắn
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // Chỉ xử lý trong group và có text
  if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && text) {
    const tokenAddress = text;

    // Gọi cả 2 API song song, xử lý lỗi riêng biệt
    const [dexResult, rugResult] = await Promise.allSettled([
      getSolanaTokenInfo(tokenAddress),
      getRugCheckInfo(tokenAddress)
    ]);

    const dexData = dexResult.status === 'fulfilled' ? dexResult.value : null;
    const rugData = rugResult.status === 'fulfilled' ? rugResult.value : null;


    const tLinkMevx = `https://mevx.io/solana/${tokenAddress}`;
    const checkCallTele = `https://t.me/spydefi_bot?start=${tokenAddress}`;


    // 🔴 Báo lỗi nếu không có API nào trả dữ liệu
    if (!dexData && !rugData) {
      return bot.sendMessage(chatId, `❌ Không tìm thấy token hoặc có lỗi xảy ra ở *cả hai API* (Dexscreener & Rugcheck).
🔗 <a href="${tLinkMevx}">Mevx</a>
🔗 <a href="${checkCallTele}">Check Call</a>`, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
    
    // 🟡 Báo lỗi từng phần nếu 1 API lỗi (nhưng vẫn kèm link ChatGPT)
    if (!dexData) {
      bot.sendMessage(chatId, `❌ Lỗi khi gọi Dexscreener.
🔗 <a href="${tLinkMevx}">Mevx</a>
🔗 <a href="${checkCallTele}">Check Call</a>`, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
    if (!rugData) {
      bot.sendMessage(chatId, `⚠️ Lỗi khi gọi Rugcheck.
🔗 <a href="${tLinkMevx}">Mevx</a>
🔗 <a href="${checkCallTele}">Check Call</a>`, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
    

    // Nếu không có dexData thì không thể hiển thị ảnh và thông tin cơ bản
    if (!dexData) return;

    const name = dexData.baseToken?.name || 'Unknown';
    const symbol = dexData.baseToken?.symbol || '';
    const price = dexData.priceUsd || 'N/A';
    const volume = dexData.volume?.h24 ? `$${Number(dexData.volume.h24).toLocaleString()}` : 'N/A';
    const liquidity = dexData.liquidity?.usd ? `$${Number(dexData.liquidity.usd).toLocaleString()}` : 'N/A';
    const dexLink = dexData.url || 'https://dexscreener.com';
    const socials = dexData.info?.socials?.map(s => `<a href="${s.url}">${s.type}</a>`).join(' | ') || '';
    const image = dexData.info?.imageUrl || null;

    let rugCheck = '';
if (rugData) {
  const score = rugData.score || 'N/A';
  const risk = rugData.risk || 'Unknown';
  const renounced = rugData.renounced ? '✅ Renounced' : '❌ Not Renounced';

  rugCheck = `\n🛡️ <b>RugCheck</b>
Score: ${score}
🔗 <a href="${tLinkMevx}">Mevx</a>
🔗 <a href="${checkCallTele}">Check Call</a>
🔗 <a href="https://solscan.io/account/${rugData.creator}?remove_spam=true&exclude_amount_zero=true&token_address=${rugData.mint}#transfers">Dev Buy/Sell</a> `;
  const holders = rugData.topHolders;
  if (holders && holders.length > 0) {
    rugCheck += `\n📊<b>Top Holder Coin</b>\n`;
    holders.slice(0, 20).forEach(holder => {
      const link = `https://solscan.io/account/${holder.owner}?remove_spam=true&exclude_amount_zero=true&token_address=${rugData.mint}#transfers`;
      const percent = holder.pct.toFixed(1);
      const isDev = holder.owner === rugData.creator ? " (dev)" : "";
      rugCheck += `<a href="${link}">${percent}%</a>${isDev} | `;

    });
    rugCheck += `\n↳💵 <b> Liquidity Ratio:</b> ${holders[0].pct.toFixed(1)}%\n`;
    rugCheck += `↳🥇 <b> Top 1 Holders:</b> ${holders[1]?.pct?.toFixed(1) || 'N/A'}%\n`;
    rugCheck += `↳🔟 <b> Top 10 Holders:</b> ${holders.slice(1, 11).reduce((sum, h) => sum + h.pct, 0).toFixed(1)}%\n`;
    rugCheck += `↳🔝 <b> Top 20 Holders:</b> ${holders.slice(1, 21).reduce((sum, h) => sum + h.pct, 0).toFixed(1)}%\n`;
 
  }
}

    

    const response = `
<b>${name} (${symbol})</b>
📊 Volume 24h: ${volume}`;

    const fullMessage = response + rugCheck;







    if (image) {
        bot.sendPhoto(chatId, image, {
          caption: fullMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
      } else {
        bot.sendMessage(chatId, fullMessage, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
      }
  
  }
});
