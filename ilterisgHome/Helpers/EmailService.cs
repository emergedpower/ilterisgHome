using ilterisg.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using MimeKit;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ilterisg.Helpers
{
    public class EmailService : IEmailService
    {
        private readonly IStringLocalizer<SharedResource> _localizer;

        public EmailService(IConfiguration configuration, IStringLocalizer<SharedResource> localizer)
        {
            _localizer = localizer;
            SmtpConfig.Initialize(configuration);
        }

        public async Task SendAdminNotificationAsync(
            string email,
            string phone,
            string? firmaAdi = null,
            string? vergiDairesi = null,
            string? vergiNumarasi = null,
            string? sskSicilNo = null)
        {
            var subject = _localizer["AdminNotificationSubject"].Value;
            if (string.IsNullOrWhiteSpace(subject))
            {
                subject = "Yeni Kullanici Basvurusu | IlterISG";
            }

            var isIndividual = string.IsNullOrWhiteSpace(firmaAdi);
            var header = isIndividual ? "Yeni Bireysel Kullanici Basvurusu" : "Yeni Firma Basvurusu";

            var details = isIndividual
                ? $@"
                    <p><strong>E-posta:</strong> {GetValueOrNotSpecified(email)}</p>
                    <p><strong>Telefon:</strong> {GetValueOrNotSpecified(phone)}</p>
                    <p><strong>Basvuru Tarihi:</strong> {DateTime.Now:dd.MM.yyyy HH:mm}</p>"
                : $@"
                    <p><strong>Firma Adi:</strong> {GetValueOrNotSpecified(firmaAdi)}</p>
                    <p><strong>E-posta:</strong> {GetValueOrNotSpecified(email)}</p>
                    <p><strong>Telefon:</strong> {GetValueOrNotSpecified(phone)}</p>
                    <p><strong>Basvuru Tarihi:</strong> {DateTime.Now:dd.MM.yyyy HH:mm}</p>
                    <p><strong>Vergi Dairesi:</strong> {GetValueOrNotSpecified(vergiDairesi)}</p>
                    <p><strong>Vergi Numarasi:</strong> {GetValueOrNotSpecified(vergiNumarasi)}</p>
                    <p><strong>SSK Sicil No:</strong> {GetValueOrNotSpecified(sskSicilNo)}</p>";

            var body = $@"
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }}
        .header {{ font-size: 24px; color: #4CAF50; margin-bottom: 20px; text-align: center; }}
        .details {{ margin-bottom: 20px; }}
        .details p {{ margin: 5px 0; }}
        .footer {{ font-size: 12px; color: #777; text-align: center; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>{header}</div>
        <div class='details'>
            {details}
        </div>
        <div class='footer'>
            <p>Bu e-posta otomatik olarak gonderilmistir. Lutfen yanitlamayiniz.</p>
        </div>
    </div>
</body>
</html>";

            var recipients = new List<string>
            {
                "ilteris@ilterisg.com",
                "ertugruldurmaz@ilterisg.com",
                "ler.umut.zm@gmail.com"
            };

            await SendEmailAsync(recipients, subject, body);
        }

        public async Task SendContactFormNotificationAsync(string name, string phone, string subject)
        {
            var emailSubject = _localizer["ContactFormSubject"].Value;
            if (string.IsNullOrWhiteSpace(emailSubject))
            {
                emailSubject = "Yeni Iletisim Formu Basvurusu | IlterISG";
            }

            var body = $@"
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }}
        .header {{ font-size: 24px; color: #4CAF50; margin-bottom: 20px; text-align: center; }}
        .details {{ margin-bottom: 20px; }}
        .details p {{ margin: 5px 0; }}
        .footer {{ font-size: 12px; color: #777; text-align: center; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>Yeni Iletisim Formu Basvurusu</div>
        <div class='details'>
            <p><strong>Isim-Soyisim:</strong> {GetValueOrNotSpecified(name)}</p>
            <p><strong>Telefon:</strong> {GetValueOrNotSpecified(phone)}</p>
            <p><strong>Konu:</strong> {GetValueOrNotSpecified(subject)}</p>
            <p><strong>Basvuru Tarihi:</strong> {DateTime.Now:dd.MM.yyyy HH:mm}</p>
        </div>
        <div class='footer'>
            <p>Bu e-posta otomatik olarak gonderilmistir. Lutfen yanitlamayiniz.</p>
        </div>
    </div>
</body>
</html>";

            var recipients = new List<string>
            {
                "ilteris@ilterisg.com",
                "ertugruldurmaz@ilterisg.com",
                "ler.umut.zm@gmail.com"
            };

            await SendEmailAsync(recipients, emailSubject, body);
        }

        public Task SendEmailAsync(string toEmail, string subject, string body)
        {
            return SendEmailAsync(new List<string> { toEmail }, subject, body);
        }

        private async Task SendEmailAsync(List<string> toEmails, string subject, string body)
        {
            if (toEmails == null || !toEmails.Any(e => !string.IsNullOrWhiteSpace(e)))
            {
                Log.Information("Email listesi bos, gonderme atlandi: Konu={Subject}", subject);
                return;
            }

            if (string.IsNullOrWhiteSpace(SmtpConfig.Host) ||
                string.IsNullOrWhiteSpace(SmtpConfig.Username) ||
                string.IsNullOrWhiteSpace(SmtpConfig.Password))
            {
                Log.Error("SMTP ayarlari eksik: Host={Host}, Username={Username}", SmtpConfig.Host, SmtpConfig.Username);
                return;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(SmtpConfig.FromName, SmtpConfig.FromEmail));

                foreach (var email in toEmails.Where(e => !string.IsNullOrWhiteSpace(e)))
                {
                    message.To.Add(new MailboxAddress(string.Empty, email));
                }

                message.Subject = subject;
                message.Body = new TextPart("html") { Text = body };

                using var client = new SmtpClient();
                var secureSocket = SmtpConfig.EnableSsl
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTlsWhenAvailable;

                await client.ConnectAsync(SmtpConfig.Host, SmtpConfig.Port, secureSocket);
                await client.AuthenticateAsync(SmtpConfig.Username, SmtpConfig.Password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                Log.Information("E-posta gonderildi: Alicilar={ToEmails}, Konu={Subject}", string.Join(",", toEmails), subject);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "E-posta gonderimi basarisiz: Alicilar={ToEmails}, Konu={Subject}", string.Join(",", toEmails), subject);
            }
        }

        private static string GetValueOrNotSpecified(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? "Belirtilmedi" : value;
        }
    }
}
