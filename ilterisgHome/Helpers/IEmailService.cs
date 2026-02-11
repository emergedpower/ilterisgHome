using System.Threading.Tasks;

namespace ilterisg.Helpers
{
    public interface IEmailService
    {
        Task SendAdminNotificationAsync(
            string email,
            string phone,
            string? firmaAdi = null,
            string? vergiDairesi = null,
            string? vergiNumarasi = null,
            string? sskSicilNo = null);

        Task SendContactFormNotificationAsync(string name, string phone, string subject);

        Task SendEmailAsync(string toEmail, string subject, string body);
    }
}
