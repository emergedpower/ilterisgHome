public static class SmtpConfig
{
    public static string? Host { get; private set; }
    public static int Port { get; private set; }
    public static bool EnableSsl { get; private set; }
    public static string? Username { get; private set; }
    public static string? Password { get; private set; }
    public static string? FromEmail { get; private set; }
    public static string? FromName { get; private set; }
    public static string? ImapServer { get; private set; }
    public static string? ImapPort { get; private set; }

    public static void Initialize(IConfiguration configuration)
    {
        Host = configuration["SmtpConfig:Host"];
        Port = int.TryParse(configuration["SmtpConfig:Port"], out var port) ? port : 587;
        EnableSsl = bool.TryParse(configuration["SmtpConfig:EnableSsl"], out var enableSsl) && enableSsl;
        Username = configuration["SmtpConfig:Username"];
        Password = configuration["SmtpConfig:Password"];
        FromEmail = configuration["SmtpConfig:FromEmail"];
        FromName = configuration["SmtpConfig:FromName"];
        ImapServer = configuration["SmtpConfig:ImapServer"];
        ImapPort = configuration["SmtpConfig:ImapPort"];
    }
}
