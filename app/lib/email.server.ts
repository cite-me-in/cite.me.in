import envVars from "~/lib/envVars";
import resend from "~/lib/resend.server";

export async function sendPasswordRecoveryEmail(to: string, token: string) {
  const url = `${envVars.APP_URL}/reset-password/${token}`;

  const { error } = await resend.emails.send({
    from: envVars.EMAIL_FROM,
    to,
    subject: "Reset your CiteUp password",
    html: `<p>Click <a href="${url}">this link</a> to sign in to CiteUp. The link expires in 30 minutes and can only be used once.</p><p>If you didn't request this, ignore this email.</p>`,
  });
  if (error) throw new Error(error.message);
}

export async function sendEmailVerificationEmail(to: string, token: string) {
  const url = `${envVars.APP_URL}/verify-email/${token}`;

  const { error } = await resend.emails.send({
    from: envVars.EMAIL_FROM,
    to,
    subject: "Verify your CiteUp email",
    html: `<p>Click <a href="${url}">this link</a> to verify your email address. The link expires in 24 hours.</p><p>If you didn't create an account, ignore this email.</p>`,
  });
  if (error) throw new Error(error.message);
}
