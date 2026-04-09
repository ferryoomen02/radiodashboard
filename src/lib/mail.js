/**
 * E-mail voor uitnodigingen. Zonder SMTP-config wordt alleen gelogd (geschikt voor dev / later koppelen).
 */
export async function sendInviteEmail(to, inviteUrl) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.info(`[mail] SMTP niet geconfigureerd. Uitnodiging voor ${to}: ${inviteUrl}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    const from = process.env.SMTP_FROM || "noreply@localhost";
    await transporter.sendMail({
      from,
      to,
      subject: "Uitnodiging SonicWave platform",
      text: `Je bent uitgenodigd om een account aan te maken.\n\nOpen deze link:\n${inviteUrl}\n\nDe link is een week geldig.`,
      html: `<p>Je bent uitgenodigd om een account aan te maken op het SonicWave-platform.</p><p><a href="${inviteUrl}">Account aanmaken</a></p><p>De link is een week geldig.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mail] verzenden mislukt:", err);
    return { sent: false, reason: String(err?.message || err) };
  }
}
