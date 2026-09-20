// API Route นี้รันฝั่ง Server เท่านั้น จึงใช้ Bot Token แบบ server-only ได้อย่างปลอดภัย
// (env var ไม่มี NEXT_PUBLIC_ prefix เพื่อไม่ให้หลุดไปฝั่ง client)

export async function POST(request) {
  try {
    const { text } = await request.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // ถ้ายังไม่ได้ตั้งค่า env ให้ตอบกลับแบบไม่ error แรง (กันระบบขายพัง)
    if (!botToken || !chatId) {
      return Response.json(
        { ok: false, error: 'Telegram env vars not configured' },
        { status: 200 }
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const res = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    return Response.json({ ok: data.ok === true, data }, { status: 200 });
  } catch (err) {
    // จับ error ทุกกรณี ไม่ให้กระทบระบบขาย
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
