import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email Service for sending transactional emails
 * Uses nodemailer with SMTP configuration from environment variables
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter with SMTP configuration
   */
  private initializeTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP configuration incomplete. Email sending will be mocked.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    this.logger.log('Email transporter initialized successfully');
  }

  /**
   * Send email verification OTP
   */
  async sendVerificationEmail(
    email: string,
    otp: string,
    firstName?: string,
  ): Promise<void> {
    const subject = 'Verify Your Email - Vritti AI Cloud';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Hello${firstName ? ` ${firstName}` : ''},</p>
        <p>Thank you for signing up with Vritti AI Cloud. Please use the following verification code to complete your registration:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">Vritti AI Cloud - Cloud Management Platform</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  /**
   * Send password reset OTP
   */
  async sendPasswordResetEmail(
    email: string,
    otp: string,
    firstName?: string,
  ): Promise<void> {
    const subject = 'Reset Your Password - Vritti AI Cloud';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset</h2>
        <p>Hello${firstName ? ` ${firstName}` : ''},</p>
        <p>We received a request to reset your password. Use the following code to complete the process:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">Vritti AI Cloud - Cloud Management Platform</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      if (!this.transporter) {
        this.logger.warn(`[MOCK] Email would be sent to ${to}: ${subject}`);
        this.logger.debug(`[MOCK] Email content: ${html}`);
        return;
      }

      const from = this.configService.get<string>(
        'SMTP_FROM',
        'noreply@vritti.ai',
      );

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Verify SMTP connection (useful for health checks)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
      return false;
    }
  }
}
