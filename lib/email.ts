// lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationUrl: string
) {
  try {
    await resend.emails.send({
      // from: process.env.EMAIL_FROM!,
      from: "HQ Warehouse <no-reply@emails.teevong.com>",
      to: email,
      subject: "Verify your email address",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; }
              .logo { width: 64px; height: 64px; margin: 0 auto; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
              .button { 
                display: inline-block; 
                padding: 12px 30px; 
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
                color: white !important; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: bold;
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to HQ Warehouse Management!</h1>
              </div>
              <div class="content">
                <p>Hi ${name},</p>
                <p>Welcome to the team! Please verify your email address to activate your account.</p>
                <div style="text-align: center; color: #fff">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 14px;">${verificationUrl}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} HQ Warehouse Management. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw error;
  }
}
