using ilterisg.Helpers;
using ilterisg.Models;
using ilterisgHome.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Localization;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace ilterisg.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly IEmailService _emailService;
        private readonly IStringLocalizer<SharedResource> _localizer;

        public HomeController(
            ILogger<HomeController> logger,
            IEmailService emailService,
            IStringLocalizer<SharedResource> localizer)
        {
            _logger = logger;
            _emailService = emailService;
            _localizer = localizer;
        }

        public IActionResult Index() => View();

        public IActionResult Services() => View();

        public IActionResult About() => View();

        public IActionResult Contact() => View();

        public IActionResult Faq() => View();

        public IActionResult Post() => View();

        public IActionResult Search(string s)
        {
            return View(new SearchViewModel { Query = s ?? string.Empty });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting("ContactForm")]
        public async Task<IActionResult> SendContactForm(string name, string phone, string subject)
        {
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(subject))
            {
                _logger.LogWarning("İletişim formu: eksik alan. Name={Name}, Phone={Phone}, Subject={Subject}", name, phone, subject);
                return Json(new { success = false, message = _localizer["AllFieldsRequired"].Value });
            }

            if (!Regex.IsMatch(phone, @"^(0?\d{10})$"))
            {
                _logger.LogWarning("İletişim formu: geçersiz telefon. Phone={Phone}", phone);
                return Json(new { success = false, message = _localizer["InvalidPhoneNumber"].Value });
            }

            try
            {
                await _emailService.SendContactFormNotificationAsync(name, phone, subject);
                _logger.LogInformation("İletişim formu gönderildi. Name={Name}, Phone={Phone}, Subject={Subject}", name, phone, subject);
                return Json(new { success = true, message = _localizer["MessageSentSuccessfully"].Value });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "İletişim formu gönderimi sırasında hata. Name={Name}, Phone={Phone}, Subject={Subject}", name, phone, subject);
                return Json(new { success = false, message = _localizer["ErrorOccurred"].Value });
            }
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }

    public class SearchViewModel
    {
        public string Query { get; set; } = string.Empty;
    }
}
