using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using ilterisg.Data;
using ilterisg.Models;
using ilterisg.Services;
using Microsoft.Extensions.Logging;
using ilterisg.DTOs;
using Microsoft.AspNetCore.SignalR;
using ilterisg.Hubs;
using ilterisg.Models.Enums;
using System.Collections.Generic;

namespace ilterisg.Controllers {
    [Authorize]
    public class CalendarController : Controller
    {
        private readonly AppDbContext _context;
        private readonly IBildirimService _bildirimService;
        private readonly ILogger < CalendarController > _logger;
        private readonly IHubContext < NotificationHub > _notificationHubContext;

        public CalendarController(
        AppDbContext context,
        IBildirimService bildirimService,
        ILogger < CalendarController > logger,
        IHubContext < NotificationHub > notificationHubContext)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _bildirimService = bildirimService ?? throw new ArgumentNullException(nameof(bildirimService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _notificationHubContext = notificationHubContext ?? throw new ArgumentNullException(nameof(notificationHubContext));
        }

        // MVC Route: /Calendar
        [HttpGet]
        public IActionResult Index()
        {
            _logger.LogInformation("Index action çaðrýldý. Kullanýcý: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));
            return View();
        }

        // API Route: api/Calendar/SaveEgitim
        [HttpPost]
        [Route("api/Calendar/SaveEgitim")]
        [ValidateAntiForgeryToken]
        public async Task < IActionResult > SaveEgitim([FromBody] EgitimCreateDto egitimDto)
        {
            _logger.LogInformation("SaveEgitim çaðrýldý. Gelen veri: {@EgitimDto}, Kullanýcý: {UserId}", egitimDto, User.FindFirstValue(ClaimTypes.NameIdentifier));

            if (egitimDto == null) {
                _logger.LogWarning("Eðitim DTO nesnesi null geldi.");
                return BadRequest(new { success = false, message = "Eðitim verisi eksik." });
            }

            // Zorunlu alanlar [Required] tarafýndan kontrol edilir
            var firma = await _context.Firmalar.FirstOrDefaultAsync(f => f.FirmaId == egitimDto.RefFirmaId);
            if (firma == null) {
                _logger.LogWarning("Firma bulunamadý: RefFirmaId: {RefFirmaId}", egitimDto.RefFirmaId);
                return BadRequest(new { success = false, message = "Geçersiz firma ID’si." });
            }

            var egitimTuruObj = await _context.EgitimTurleri.FirstOrDefaultAsync(et => et.EgitimTuruId == egitimDto.EgitimTuruId);
            if (egitimTuruObj == null) {
                _logger.LogWarning("Eðitim türü bulunamadý: EgitimTuruId: {EgitimTuruId}", egitimDto.EgitimTuruId);
                return BadRequest(new { success = false, message = "Geçersiz eðitim türü ID’si." });
            }

            // Rol kontrolü
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRoles = await _context.UserRoles
                .Where(ur => ur.UserId == userId)
                .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
                .ToListAsync();
            if (!userRoles.Contains("OSGB")) {
                _logger.LogWarning("Kullanýcýda OSGB rolü yok. UserId: {UserId}", userId);
                return Unauthorized(new { success = false, message = "Etkinlik oluþturma yetkiniz yok." });
            }

            // OSGB’nin bu firmaya eriþim yetkisi var mý kontrol et
            var osgb = await _context.OSGBler
                .Include(o => o.OSGB_Firmalar)
                .FirstOrDefaultAsync(o => o.ApplicationUserId == userId);
            if (osgb != null && !osgb.OSGB_Firmalar.Any(of => of.RefFirmaId == egitimDto.RefFirmaId)) {
                _logger.LogWarning("OSGB kullanýcýsýnýn bu firmaya eriþim yetkisi yok. UserId: {UserId}, FirmaId: {FirmaId}", userId, egitimDto.RefFirmaId);
                return Unauthorized(new { success = false, message = "Bu firma için etkinlik oluþturma yetkiniz yok." });
            }

            // Varsayýlan deðerler ve kontroller
            egitimDto.Ad = string.IsNullOrWhiteSpace(egitimDto.Ad) ? "Belirtilmedi" : egitimDto.Ad;
            egitimDto.EgitimTarihi = egitimDto.EgitimTarihi.Date; // Saat bilgisi sýfýrlanýr
            egitimDto.Sure = egitimDto.Sure <= 0 ? 1 : egitimDto.Sure;
            if (!Enum.TryParse < TehlikeSinifi > (egitimDto.TehlikeSinifi, true, out var parsedTehlikeSinifi))
                {
                    parsedTehlikeSinifi = TehlikeSinifi.AzTehlikeli;
            _logger.LogWarning("Geçersiz tehlike sýnýfý, varsayýlan olarak AzTehlikeli atandý: {TehlikeSinifi}", egitimDto.TehlikeSinifi);
        }

            Egitimler egitim = null;
            string bildirimMesaji = string.Empty;

        try {
            if (egitimDto.EgitimId.HasValue && egitimDto.EgitimId > 0) // Güncelleme
            {
                egitim = await _context.Egitimler
                    .Include(e => e.FirmaEgitimler)
                    .ThenInclude(fe => fe.Firma)
                    .FirstOrDefaultAsync(e => e.EgitimId == egitimDto.EgitimId && !e.SilindiMi);
                if (egitim == null) {
                    _logger.LogWarning("Eðitim bulunamadý veya silinmiþ: EgitimId: {EgitimId}", egitimDto.EgitimId);
                    return BadRequest(new { success = false, message = "Eðitim bulunamadý veya silinmiþ." });
                }
                // Düzenleme yetkisi kontrolü
                var existingFirmaEgitim = egitim.FirmaEgitimler.FirstOrDefault(fe => fe.RefFirmaId == egitimDto.RefFirmaId);
                if (existingFirmaEgitim == null || (osgb != null && !osgb.OSGB_Firmalar.Any(of => of.RefFirmaId == egitimDto.RefFirmaId))) {
                    _logger.LogWarning("Kullanýcý bu etkinliði düzenleme yetkisine sahip deðil. EgitimId: {EgitimId}, FirmaId: {FirmaId}", egitimDto.EgitimId, egitimDto.RefFirmaId);
                    return Unauthorized(new { success = false, message = "Bu etkinliði düzenleme yetkiniz yok." });
                }
                // Mevcut veriyi güncelle
                egitim.Ad = egitimDto.Ad;
                egitim.EgitimTarihi = egitimDto.EgitimTarihi;
                egitim.Sure = egitimDto.Sure;
                egitim.TehlikeSinifi = parsedTehlikeSinifi;
                egitim.EgitimTuruId = egitimDto.EgitimTuruId;
                _logger.LogInformation("Eðitim güncelleniyor: {@Egitim}", egitim);
            }
            else // Yeni kayýt
            {
                egitim = new Egitimler
                {
                    Ad = egitimDto.Ad,
                        EgitimTarihi = egitimDto.EgitimTarihi,
                        Sure = egitimDto.Sure,
                        TehlikeSinifi = parsedTehlikeSinifi,
                        EgitimTuruId = egitimDto.EgitimTuruId,
                        TamamlandiMi = false,
                        SilindiMi = false
                };
                _context.Egitimler.Add(egitim);
                _logger.LogInformation("Yeni eðitim oluþturuluyor: {@Egitim}", egitim);
            }

            // Kaydý kaydet
            await _context.SaveChangesAsync();
            _logger.LogInformation("Eðitim kaydedildi: EgitimId: {EgitimId}", egitim.EgitimId);

            // Firma_Egitim iliþkisi yalnýzca yeni kayýtlar için eklenir
            var firmaEgitim = await _context.Firma_Egitim.FirstOrDefaultAsync(fe => fe.RefEgitimId == egitim.EgitimId);
            if (firmaEgitim == null && !egitimDto.EgitimId.HasValue) {
                var newFirmaEgitim = new Firma_Egitim
                {
                    RefEgitimId = egitim.EgitimId,
                        RefFirmaId = egitimDto.RefFirmaId
                };
                _context.Firma_Egitim.Add(newFirmaEgitim);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Firma_Egitim iliþkisi eklendi: RefEgitimId: {RefEgitimId}, RefFirmaId: {RefFirmaId}", newFirmaEgitim.RefEgitimId, newFirmaEgitim.RefFirmaId);
            }

            // Bildirim gönderimi
            if (firma != null && !string.IsNullOrEmpty(firma.ApplicationUserId)) {
                var yonetici = await _context.Users.FirstOrDefaultAsync(u => u.Id == firma.ApplicationUserId);
                if (yonetici != null) {
                    var osgbFirma = await _context.OSGB_Firmalar
                        .Include(of => of.OSGB)
                        .FirstOrDefaultAsync(of => of.RefFirmaId == firma.FirmaId);
                    var osgbAdi = osgbFirma != null && osgbFirma.OSGB != null ? osgbFirma.OSGB.OSGBAdi : "Belirtilmedi";

                    var egitimTuruObj2 = await _context.EgitimTurleri.FirstOrDefaultAsync(et => et.EgitimTuruId == egitim.EgitimTuruId);
                    var egitimTuruAdi = egitimTuruObj2 != null ? egitimTuruObj2.Ad : "Belirtilmedi";

                    bildirimMesaji = $"{osgbAdi} tarafýndan {egitim.Ad} ({egitimTuruAdi}) eðitimi {(egitimDto.EgitimId.HasValue ? "güncellendi" : "oluþturuldu")}";
                    await _bildirimService.SendNotificationAsync(yonetici.Id, bildirimMesaji, egitimDto.EgitimId.HasValue ? "Eðitim Güncelleme" : "Eðitim Oluþturma", egitim.EgitimId);
                    _logger.LogInformation("Bildirim gönderildi: EgitimId: {EgitimId}, Mesaj: {Mesaj}", egitim.EgitimId, bildirimMesaji);
                }
                else {
                    _logger.LogWarning("Yönetici bulunamadý: ApplicationUserId: {ApplicationUserId}", firma.ApplicationUserId);
                }
            }
            else {
                _logger.LogWarning("Firma bulunamadý veya ApplicationUserId eksik: FirmaId: {FirmaId}", egitimDto.RefFirmaId);
            }

            // SignalR ile takvim güncellemesi
            var eventData = new
                {
                    id = egitim.EgitimId.ToString(),
                    title = firma.FirmaAdi + " - " + egitim.Ad,
                    start = egitim.EgitimTarihi.ToString("yyyy-MM-dd"),
                    end = egitim.EgitimTarihi.AddHours(egitim.Sure).ToString("yyyy-MM-dd"),
                    className = GetEventClass(egitim.TehlikeSinifi),
                    allDay = true
                };
            await _notificationHubContext.Clients.All.SendAsync("ReceiveEventUpdate", eventData);
            _logger.LogInformation("SignalR ile takvim güncellendi: {@EventData}", eventData);

            return Json(new { success = true, message = bildirimMesaji, egitimId = egitim.EgitimId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Eðitim kaydetme/güncelleme hatasý: {@EgitimDto}. Ýç hata: {InnerException}", egitimDto, ex.InnerException?.Message ?? "Yok");
            return StatusCode(500, new { success = false, message = "Eðitim iþlemi baþarýsýz: " + (ex.InnerException?.Message ?? ex.Message) });
        }
    }

    // API Route: api/Calendar/SaveEtkinlik
    [HttpPost]
    [Route("api/Calendar/SaveEtkinlik")]
    [ValidateAntiForgeryToken]
        public async Task < IActionResult > SaveEtkinlik([FromBody] EtkinlikCreateDto etkinlikDto)
    {
        _logger.LogInformation("SaveEtkinlik çaðrýldý. Gelen veri: {@EtkinlikDto}, Kullanýcý: {UserId}", etkinlikDto, User.FindFirstValue(ClaimTypes.NameIdentifier));

        if (etkinlikDto == null) {
            _logger.LogWarning("Etkinlik DTO nesnesi null geldi.");
            return BadRequest(new { success = false, message = "Etkinlik verisi eksik." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Etkinlikler etkinlik = null;

        try {
            // Etkinlik türünü kontrol et
            if (!Enum.TryParse < EtkinlikTuru > (etkinlikDto.EtkinlikTuru, true, out var etkinlikTuru))
                {
                    etkinlikTuru = EtkinlikTuru.Etkinlik;
            _logger.LogWarning("Geçersiz etkinlik türü, varsayýlan olarak Etkinlik atandý: {EtkinlikTuru}", etkinlikDto.EtkinlikTuru);
        }

                // Firma doðrulamasý (Toplanti, Ziyaret, Diger için zorunlu)
                if (new [] { EtkinlikTuru.Toplanti, EtkinlikTuru.Ziyaret, EtkinlikTuru.Diger }.Contains(etkinlikTuru))
        {
            if (!etkinlikDto.RefFirmaId.HasValue) {
                _logger.LogWarning("Firma ID eksik: EtkinlikTuru: {EtkinlikTuru}", etkinlikTuru);
                return BadRequest(new { success = false, message = "Firma seçimi zorunlu." });
            }

            var firma = await _context.Firmalar.FirstOrDefaultAsync(f => f.FirmaId == etkinlikDto.RefFirmaId.Value);
            if (firma == null) {
                _logger.LogWarning("Geçersiz firma ID: {RefFirmaId}", etkinlikDto.RefFirmaId);
                return BadRequest(new { success = false, message = "Geçersiz firma ID’si." });
            }
        }

        // Personel doðrulamasý
        if (etkinlikDto.AtananKullaniciIds != null && etkinlikDto.AtananKullaniciIds.Any()) {
            var validKullaniciIds = await _context.Kullanicilar
                .Where(k => etkinlikDto.AtananKullaniciIds.Contains(k.KullaniciId))
                .Select(k => k.KullaniciId)
                .ToListAsync();
            if (etkinlikDto.AtananKullaniciIds.Any(id => !validKullaniciIds.Contains(id))) {
                _logger.LogWarning("Geçersiz KullaniciId’ler: {AtananKullaniciIds}", etkinlikDto.AtananKullaniciIds);
                return BadRequest(new { success = false, message = "Geçersiz kullanýcý ID’leri." });
            }
        }

        if (etkinlikDto.EtkinlikId.HasValue && etkinlikDto.EtkinlikId > 0) // Güncelleme
        {
            etkinlik = await _context.Etkinlikler
                .Include(e => e.EtkinlikKullanicilar)
                .FirstOrDefaultAsync(e => e.Id == etkinlikDto.EtkinlikId && !e.SilindiMi && e.KullaniciId == userId);
            if (etkinlik == null) {
                _logger.LogWarning("Etkinlik bulunamadý veya silinmiþ: EtkinlikId: {EtkinlikId}", etkinlikDto.EtkinlikId);
                return BadRequest(new { success = false, message = "Etkinlik bulunamadý veya silinmiþ." });
            }

            // Mevcut veriyi güncelle
            etkinlik.Ad = etkinlikDto.Ad;
            etkinlik.BaslangicTarihi = etkinlikDto.BaslangicTarihi.Date;
            etkinlik.BitisTarihi = etkinlikDto.BitisTarihi?.Date;
            etkinlik.Aciklama = etkinlikDto.Aciklama;
            etkinlik.EtkinlikTuru = etkinlikTuru;
            etkinlik.RefFirmaId = etkinlikDto.RefFirmaId;

            // Mevcut personel atamalarýný temizle
            _context.Etkinlik_Kullanici.RemoveRange(etkinlik.EtkinlikKullanicilar);
        }
        else // Yeni kayýt
        {
            etkinlik = new Etkinlikler
            {
                Ad = etkinlikDto.Ad,
                    BaslangicTarihi = etkinlikDto.BaslangicTarihi.Date,
                    BitisTarihi = etkinlikDto.BitisTarihi?.Date,
                    Aciklama = etkinlikDto.Aciklama,
                    KullaniciId = userId,
                    EtkinlikTuru = etkinlikTuru,
                    RefFirmaId = etkinlikDto.RefFirmaId,
                    SilindiMi = false
            };
            _context.Etkinlikler.Add(etkinlik);
        }

        // Kaydý kaydet
        await _context.SaveChangesAsync();
        _logger.LogInformation("Etkinlik kaydedildi: EtkinlikId: {EtkinlikId}", etkinlik.Id);

        // Personel atamalarýný kaydet
        if (etkinlikDto.AtananKullaniciIds != null && etkinlikDto.AtananKullaniciIds.Any()) {
            foreach(var kullaniciId in etkinlikDto.AtananKullaniciIds)
            {
                var etkinlikKullanici = new Etkinlik_Kullanici
                {
                    RefEtkinlikId = etkinlik.Id,
                        RefKullaniciId = kullaniciId
                };
                _context.Etkinlik_Kullanici.Add(etkinlikKullanici);
            }
            await _context.SaveChangesAsync();
            _logger.LogInformation("Personel atamalarý kaydedildi: EtkinlikId: {EtkinlikId}, Atanan Kullanýcý Sayýsý: {Count}", etkinlik.Id, etkinlikDto.AtananKullaniciIds.Count);
        }

        // SignalR ile takvim güncellemesi
        var eventData = new
            {
                id = "etkinlik-" + etkinlik.Id,
                title = etkinlik.Ad,
                start = etkinlik.BaslangicTarihi.ToString("yyyy-MM-dd"),
                end = etkinlik.BitisTarihi?.ToString("yyyy-MM-dd"),
                className = GetEventClassForEtkinlikTuru(etkinlikTuru),
                type = "etkinlik",
                etkinlikTuru = etkinlikTuru.ToString(),
                allDay = true,
                firmaId = etkinlik.RefFirmaId,
                atanmisKullanicilar = etkinlik.EtkinlikKullanicilar.Select(ek => new
                    {
                        KullaniciId = ek.Kullanici.KullaniciId,
                        AdSoyad = ek.Kullanici.AdSoyad
                    }).ToList()
            };
        await _notificationHubContext.Clients.All.SendAsync("ReceiveEventUpdate", eventData);
        _logger.LogInformation("SignalR ile takvim güncellendi: {@EventData}", eventData);

        return Json(new { success = true, message = "Etkinlik baþarýyla kaydedildi.", etkinlikId = etkinlik.Id });
    }
            catch (Exception ex)
    {
        _logger.LogError(ex, "Etkinlik kaydetme/güncelleme hatasý: {@EtkinlikDto}. Ýç hata: {InnerException}", etkinlikDto, ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Etkinlik iþlemi baþarýsýz: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/DeleteEtkinlik
[HttpPost]
[Route("api/Calendar/DeleteEtkinlik")]
[ValidateAntiForgeryToken]
        public async Task < IActionResult > DeleteEtkinlik(int id)
{
    _logger.LogInformation("DeleteEtkinlik çaðrýldý. EtkinlikId: {Id}, Kullanýcý: {UserId}", id, User.FindFirstValue(ClaimTypes.NameIdentifier));

    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var etkinlik = await _context.Etkinlikler
        .FirstOrDefaultAsync(e => e.Id == id && !e.SilindiMi && e.KullaniciId == userId);

    if (etkinlik == null) {
        _logger.LogWarning("Etkinlik bulunamadý veya zaten silinmiþ: EtkinlikId: {Id}", id);
        return Json(new { success = false, message = "Etkinlik bulunamadý veya zaten silinmiþ." });
    }

    try {
        // Soft delete uygula
        etkinlik.SilindiMi = true;
        await _context.SaveChangesAsync();
        _logger.LogInformation("Etkinlik soft delete ile iþaretlendi: EtkinlikId: {Id}", id);

        // SignalR ile takvim güncellemesi
        await _notificationHubContext.Clients.All.SendAsync("DeleteEvent", "etkinlik-" + id.ToString());
        _logger.LogInformation("SignalR ile etkinlik silindi: EtkinlikId: {Id}", id);

        return Json(new { success = true, message = "Etkinlik baþarýyla silindi." });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Etkinlik silme hatasý: EtkinlikId: {Id}, Detay: {Message}. Ýç hata: {InnerException}", id, ex.Message, ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Etkinlik silinemedi: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/DeleteEgitim
[HttpPost]
[Route("api/Calendar/DeleteEgitim")]
[ValidateAntiForgeryToken]
        public async Task < IActionResult > DeleteEgitim(int id)
{
    _logger.LogInformation("DeleteEgitim çaðrýldý. EgitimId: {Id}, Kullanýcý: {UserId}", id, User.FindFirstValue(ClaimTypes.NameIdentifier));

    var egitim = await _context.Egitimler
        .Include(e => e.FirmaEgitimler)
        .ThenInclude(fe => fe.Firma)
        .FirstOrDefaultAsync(e => e.EgitimId == id && !e.SilindiMi);

    if (egitim == null) {
        _logger.LogWarning("Eðitim bulunamadý veya zaten silinmiþ: EgitimId: {Id}", id);
        return Json(new { success = false, message = "Eðitim bulunamadý veya zaten silinmiþ." });
    }

    // Rol kontrolü
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var userRoles = await _context.UserRoles
        .Where(ur => ur.UserId == userId)
        .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
        .ToListAsync();
    if (!userRoles.Contains("OSGB")) {
        _logger.LogWarning("Kullanýcýda OSGB rolü yok. UserId: {UserId}", userId);
        return Unauthorized(new { success = false, message = "Etkinlik silme yetkiniz yok." });
    }

    // Silme yetkisi kontrolü
    var osgb = await _context.OSGBler
        .Include(o => o.OSGB_Firmalar)
        .FirstOrDefaultAsync(o => o.ApplicationUserId == userId);
    var firmaEgitim = egitim.FirmaEgitimler.FirstOrDefault();
    if (firmaEgitim == null || (osgb != null && !osgb.OSGB_Firmalar.Any(of => of.RefFirmaId == firmaEgitim.RefFirmaId))) {
        _logger.LogWarning("Kullanýcý bu etkinliði silme yetkisine sahip deðil. EgitimId: {EgitimId}, FirmaId: {FirmaId}", id, firmaEgitim?.RefFirmaId);
        return Unauthorized(new { success = false, message = "Bu etkinliði silme yetkiniz yok." });
    }

    try {
        var firma = egitim.FirmaEgitimler.FirstOrDefault()?.Firma;

        // Soft delete uygula
        egitim.SilindiMi = true;
        await _context.SaveChangesAsync();
        _logger.LogInformation("Eðitim soft delete ile iþaretlendi: EgitimId: {Id}, Firma: {FirmaAdi}", id, firma?.FirmaAdi ?? "Bilinmeyen Firma");

        // Bildirim gönder (tek bir yerden)
        var mesaj = $"{firma?.FirmaAdi ?? "Bilinmeyen Firma"} için {egitim.Ad} eðitimi silindi.";
        if (firma?.ApplicationUserId != null) {
            await _bildirimService.SendNotificationAsync(firma.ApplicationUserId, mesaj, "Eðitim Ýptal", id);
            _logger.LogInformation("Silme bildirimi gönderildi: UserId: {UserId}, Mesaj: {Mesaj}", firma.ApplicationUserId, mesaj);
        }

        // SignalR ile takvim güncellemesi
        await _notificationHubContext.Clients.All.SendAsync("DeleteEvent", id.ToString());
        _logger.LogInformation("SignalR ile event silindi: EgitimId: {Id}", id);

        return Json(new { success = true, message = mesaj });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Eðitim silme hatasý: EgitimId: {Id}, Detay: {Message}. Ýç hata: {InnerException}", id, ex.Message, ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Eðitim silinemedi: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/ConfirmEgitim
[HttpPost]
[Route("api/Calendar/ConfirmEgitim")]
[ValidateAntiForgeryToken]
        public async Task < IActionResult > ConfirmEgitim(int id)
{
    _logger.LogInformation("ConfirmEgitim çaðrýldý. EgitimId: {Id}, Kullanýcý: {UserId}", id, User.FindFirstValue(ClaimTypes.NameIdentifier));

    var egitim = await _context.Egitimler
        .Include(e => e.FirmaEgitimler)
        .ThenInclude(fe => fe.Firma)
        .FirstOrDefaultAsync(e => e.EgitimId == id && !e.SilindiMi);

    if (egitim == null) {
        _logger.LogWarning("Eðitim bulunamadý veya silinmiþ: EgitimId: {Id}", id);
        return Json(new { success = false, message = "Eðitim bulunamadý veya silinmiþ." });
    }

    // Rol kontrolü
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var userRoles = await _context.UserRoles
        .Where(ur => ur.UserId == userId)
        .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
        .ToListAsync();
    if (!userRoles.Contains("OSGB")) {
        _logger.LogWarning("Kullanýcýda OSGB rolü yok. UserId: {UserId}", userId);
        return Unauthorized(new { success = false, message = "Etkinlik onaylama yetkiniz yok." });
    }

    // Onaylama yetkisi kontrolü
    var osgb = await _context.OSGBler
        .Include(o => o.OSGB_Firmalar)
        .FirstOrDefaultAsync(o => o.ApplicationUserId == userId);
    var firmaEgitim = egitim.FirmaEgitimler.FirstOrDefault();
    if (firmaEgitim == null || (osgb != null && !osgb.OSGB_Firmalar.Any(of => of.RefFirmaId == firmaEgitim.RefFirmaId))) {
        _logger.LogWarning("Kullanýcý bu etkinliði onaylama yetkisine sahip deðil. EgitimId: {EgitimId}, FirmaId: {FirmaId}", id, firmaEgitim?.RefFirmaId);
        return Unauthorized(new { success = false, message = "Bu etkinliði onaylama yetkiniz yok." });
    }

    try {
        egitim.TamamlandiMi = true;
        await _context.SaveChangesAsync();
        _logger.LogInformation("Eðitim onaylandý: EgitimId: {Id}", id);

        var firma = egitim.FirmaEgitimler.FirstOrDefault()?.Firma;
        var mesaj = $"{firma?.FirmaAdi ?? "Bilinmeyen Firma"} için {egitim.Ad} eðitimi onaylandý.";
        if (firma?.ApplicationUserId != null) {
            await _bildirimService.SendNotificationAsync(firma.ApplicationUserId, mesaj, "Eðitim Onaylama", id);
            _logger.LogInformation("Onaylama bildirimi gönderildi: UserId: {UserId}, Mesaj: {Mesaj}", firma.ApplicationUserId, mesaj);

            // SignalR ile bildirim
            await _notificationHubContext.Clients.User(firma.ApplicationUserId)
                .SendAsync("ReceiveNotification", mesaj, "Eðitim Onaylama", id);
        }

        // SignalR ile takvim güncellemesi
        var eventData = new
            {
                id = egitim.EgitimId.ToString(),
                title = firma?.FirmaAdi + " - " + egitim.Ad,
                start = egitim.EgitimTarihi.ToString("yyyy-MM-dd"),
                end = egitim.EgitimTarihi.AddHours(egitim.Sure).ToString("yyyy-MM-dd"),
                className = "bg-success",
                allDay = true
            };
        await _notificationHubContext.Clients.All.SendAsync("ReceiveEventUpdate", eventData);
        _logger.LogInformation("SignalR ile onaylama güncellemesi gönderildi: {@EventData}", eventData);

        return Json(new { success = true, message = mesaj });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Eðitim onaylama hatasý: EgitimId: {Id}, Detay: {Message}. Ýç hata: {InnerException}", id, ex.Message, ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Eðitim onaylanamadý: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/GetEgitimlerForCalendar
[HttpGet]
[Route("api/Calendar/GetEgitimlerForCalendar")]
        public async Task < IActionResult > GetEgitimlerForCalendar()
{
    _logger.LogInformation("GetEgitimlerForCalendar çaðrýldý. Kullanýcý: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));

    try {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userRoles = await _context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToListAsync();

        var userFirmaIds = await _context.Firmalar
            .Where(f => f.ApplicationUserId == userId)
            .Select(f => f.FirmaId)
            .ToListAsync();

        var osgb = await _context.OSGBler
            .Include(o => o.OSGB_Firmalar)
            .FirstOrDefaultAsync(o => o.ApplicationUserId == userId);
        var osgbFirmaIds = osgb != null ? osgb.OSGB_Firmalar.Select(of => of.RefFirmaId).ToList() : new List < int > ();

        if (userFirmaIds.Count == 0 && !userRoles.Contains("OSGB")) {
            return Json(new List < object > ());
        }

        // Eðitim etkinlikleri
        var egitimlerRaw = await _context.Egitimler
            .Include(e => e.FirmaEgitimler)
            .ThenInclude(fe => fe.Firma)
            .Include(e => e.EgitimTuru)
            .Where(e => e.SilindiMi == false)
            .Where(e =>
                (userRoles.Contains("OSGB") && e.FirmaEgitimler.Any(fe => osgbFirmaIds.Contains(fe.RefFirmaId))) ||
                e.FirmaEgitimler.Any(fe => userFirmaIds.Contains(fe.RefFirmaId)))
            .Select(e => new
                {
                    id = e.EgitimId.ToString(),
                    title = e.Ad,
                    start = e.EgitimTarihi,
                    sure = (int?)e.Sure,
                    tehlikeSinifi = e.TehlikeSinifi.ToString(),
                    egitimTuruId = e.EgitimTuruId,
                    egitimTuruAdi = e.EgitimTuru != null ? e.EgitimTuru.Ad : "Bilinmeyen Tür",
                    firmaId = e.FirmaEgitimler.FirstOrDefault() != null ? (int?)e.FirmaEgitimler.FirstOrDefault().RefFirmaId : null,
                    firmaAdi = e.FirmaEgitimler.FirstOrDefault() != null && e.FirmaEgitimler.FirstOrDefault().Firma != null ? e.FirmaEgitimler.FirstOrDefault().Firma.FirmaAdi : "Bilinmeyen Firma",
                    type = "egitim"
                })
            .ToListAsync();

        // Kiþisel etkinlikler ve diðer türler
        var etkinliklerRaw = await _context.Etkinlikler
            .Include(e => e.EtkinlikKullanicilar)
            .ThenInclude(ek => ek.Kullanici)
            .Include(e => e.Firma)
            .Where(e => e.SilindiMi == false && e.KullaniciId == userId)
            .Select(e => new
                {
                    id = "etkinlik-" + e.Id,
                    title = e.Ad,
                    start = e.BaslangicTarihi,
                    end = e.BitisTarihi,
                    aciklama = e.Aciklama,
                    firmaId = e.RefFirmaId,
                    firmaAdi = e.Firma != null ? e.Firma.FirmaAdi : null,
                    sure = (int?)null,
                    tehlikeSinifi = (string)null,
                    egitimTuruId = (int?)null,
                    egitimTuruAdi = (string)null,
                    type = "etkinlik",
                    etkinlikTuru = e.EtkinlikTuru.ToString(),
                    atanmisKullanicilar = e.EtkinlikKullanicilar.Select(ek => new
                        {
                            KullaniciId = ek.Kullanici.KullaniciId,
                            AdSoyad = ek.Kullanici.AdSoyad
                        }).Cast < object > ().ToList() // Anonim tipi object’e dönüþtür
                })
            .ToListAsync();

        // Eðitim etkinliklerini birleþtir
        var combinedEvents = egitimlerRaw.Select(e => new
            {
                id = e.id,
                title = e.firmaAdi + " - " + e.title + " (" + e.egitimTuruAdi + ")",
                start = e.start.ToString("yyyy-MM-dd"),
                end = e.start.AddHours(e.sure ?? 0).ToString("yyyy-MM-dd"),
                className = GetEventClass(Enum.Parse < TehlikeSinifi > (e.tehlikeSinifi)),
                sure = e.sure,
                tehlikeSinifi = e.tehlikeSinifi,
                egitimTuruId = e.egitimTuruId,
                egitimTuruAdi = e.egitimTuruAdi,
                firmaId = e.firmaId,
                firmaAdi = e.firmaAdi,
                type = e.type,
                etkinlikTuru = (string)null,
                atanmisKullanicilar = (List < object >)null,
                allDay = true
            }).ToList();

        // Kiþisel etkinlikleri birleþtir
        combinedEvents.AddRange(etkinliklerRaw.Select(e => new
            {
                id = e.id,
                title = e.title,
                start = e.start.ToString("yyyy-MM-dd"),
                end = e.end?.ToString("yyyy-MM-dd"),
                className = GetEventClassForEtkinlikTuru(Enum.Parse < EtkinlikTuru > (e.etkinlikTuru)),
                sure = e.sure,
                tehlikeSinifi = e.tehlikeSinifi,
                egitimTuruId = e.egitimTuruId,
                egitimTuruAdi = e.egitimTuruAdi,
                firmaId = e.firmaId,
                firmaAdi = e.firmaAdi,
                type = e.type,
                etkinlikTuru = e.etkinlikTuru,
                atanmisKullanicilar = e.atanmisKullanicilar,
                allDay = true
            }));

        _logger.LogInformation("Eðitim ve etkinlikler alýndý. Toplam: {Count}, Ýlk etkinlik: {@FirstEvent}", combinedEvents.Count, combinedEvents.FirstOrDefault());
        return Json(combinedEvents);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Takvim verileri alýnýrken hata oluþtu. Ýç hata: {InnerException}", ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Takvim verileri alýnamadý: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/GetEgitimTurleri
[HttpGet]
[Route("api/Calendar/GetEgitimTurleri")]
        public IActionResult GetEgitimTurleri()
{
    _logger.LogInformation("GetEgitimTurleri çaðrýldý. Kullanýcý: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));

    try {
        var egitimTurleri = _context.EgitimTurleri.ToList();
        _logger.LogInformation("Eðitim türleri alýndý. Toplam: {Count}, Ýlk tür: {@FirstTur}", egitimTurleri.Count, egitimTurleri.FirstOrDefault());
        return Json(new { success = true, data = egitimTurleri });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Eðitim türleri alýnýrken hata oluþtu. Ýç hata: {InnerException}", ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Eðitim türleri alýnamadý: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/getOSGBFirms
[HttpGet]
[Route("api/Calendar/getOSGBFirms")]
        public async Task < IActionResult > GetOSGBFirms()
{
    _logger.LogInformation("GetOSGBFirms çaðrýldý. Kullanýcý: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));

    try {
        var user = await GetCurrentUserAsync();
        if (user == null) {
            _logger.LogWarning("Kullanýcý doðrulanamadý.");
            return Unauthorized();
        }

        var osgb = await _context.OSGBler
            .Include(o => o.OSGB_Firmalar)
            .ThenInclude(of => of.Firma)
            .FirstOrDefaultAsync(o => o.ApplicationUserId == user.Id);

        if (osgb == null) {
            _logger.LogWarning("OSGB bulunamadý: UserId: {UserId}", user.Id);
            return NotFound(new { success = false, message = "OSGB bulunamadý." });
        }

        var firms = osgb.OSGB_Firmalar.Select(of => new
            {
                Id = of.Firma.FirmaId,
                Name = of.Firma.FirmaAdi
            }).ToList();

        _logger.LogInformation("OSGB firmalarý alýndý. Toplam: {Count}, Ýlk firma: {@FirstFirma}", firms.Count, firms.FirstOrDefault());
        return Ok(firms);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "OSGB firmalarý alýnýrken hata oluþtu. Ýç hata: {InnerException}", ex.InnerException?.Message ?? "Yok");
        return StatusCode(500, new { success = false, message = "Firmalar alýnamadý: " + (ex.InnerException?.Message ?? ex.Message) });
    }
}

// API Route: api/Calendar/GetUserRoles
[HttpGet]
[Route("api/Calendar/GetUserRoles")]
        public async Task < IActionResult > GetUserRoles()
{
    try {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) {
            _logger.LogWarning("GetUserRoles: Kullanýcý kimliði bulunamadý.");
            return Json(new { success = false, message = "Kullanýcý kimliði bulunamadý." });
        }

        var userRoles = await _context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToListAsync();

        // Kullanýcýnýn firmasýný bul
        var firma = await _context.Firmalar.FirstOrDefaultAsync(f => f.ApplicationUserId == userId);
        var firmaId = firma != null ? firma.FirmaId : 0;

        _logger.LogInformation("GetUserRoles: Kullanýcý rolleri ve firma ID alýndý. UserId: {UserId}, Roles: {Roles}, FirmaId: {FirmaId}", userId, string.Join(", ", userRoles), firmaId);

        return Json(new { success = true, roles = userRoles, firmaId = firmaId });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "GetUserRoles: Hata oluþtu. UserId: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));
        return Json(new { success = false, message = "Roller alýnamadý: " + ex.Message });
    }
}
// API Route: api/Calendar/GetFirmPersoneller
[HttpGet]
[Route("api/Calendar/GetFirmPersoneller")]
        public async Task < IActionResult > GetFirmPersoneller()
{
    _logger.LogInformation("GetFirmPersoneller çaðrýldý. Kullanýcý: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));

    try {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) {
            _logger.LogWarning("GetFirmPersoneller: Kullanýcý kimliði bulunamadý.");
            return Json(new { success = false, message = "Kullanýcý kimliði bulunamadý." });
        }

        // Kullanýcýnýn firmasýný bul
        var firma = await _context.Firmalar.FirstOrDefaultAsync(f => f.ApplicationUserId == userId);
        if (firma == null) {
            _logger.LogWarning("GetFirmPersoneller: Firma bulunamadý. UserId: {UserId}", userId);
            return Json(new { success = false, message = "Firma bulunamadý." });
        }

        // Firmaya baðlý personelleri çek
        var personeller = await(from kf in _context.Kullanici_Firma
                                         join k in _context.Kullanicilar on kf.RefKullaniciId equals k.KullaniciId
                                         join u in _context.Users on k.RefUserId equals u.Id
                                         where kf.RefFirmaId == firma.FirmaId
                                         select new
            {
                kullaniciId = k.KullaniciId,
                adSoyad = k.AdSoyad,
                tcKimlikNo = k.TcKimlikNo
            }).ToListAsync();

        _logger.LogInformation("GetFirmPersoneller: Personeller getirildi. UserId: {UserId}, FirmaId: {FirmaId}, Personel Sayýsý: {Count}", userId, firma.FirmaId, personeller.Count);

        return Json(new { success = true, data = personeller });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "GetFirmPersoneller: Hata oluþtu. UserId: {UserId}", User.FindFirstValue(ClaimTypes.NameIdentifier));
        return Json(new { success = false, message = "Personel listesi alýnamadý: " + ex.Message });
    }
}

// API Route: api/Calendar/CheckEventEditPermission
[HttpGet]
[Route("api/Calendar/CheckEventEditPermission")]
        public async Task < IActionResult > CheckEventEditPermission(int id)
{
    _logger.LogInformation("CheckEventEditPermission çaðrýldý. EgitimId: {Id}, Kullanýcý: {UserId}", id, User.FindFirstValue(ClaimTypes.NameIdentifier));

    var egitim = await _context.Egitimler
        .Include(e => e.FirmaEgitimler)
        .ThenInclude(fe => fe.Firma)
        .FirstOrDefaultAsync(e => e.EgitimId == id && !e.SilindiMi);

    if (egitim == null) {
        _logger.LogWarning("Eðitim bulunamadý veya silinmiþ: EgitimId: {Id}", id);
        return Json(new { success = false, message = "Eðitim bulunamadý veya silinmiþ." });
    }

    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var userRoles = await _context.UserRoles
        .Where(ur => ur.UserId == userId)
        .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
        .ToListAsync();

    if (!userRoles.Contains("OSGB")) {
        _logger.LogWarning("Kullanýcýda OSGB rolü yok. UserId: {UserId}", userId);
        return Json(new { success = false, message = "Etkinlik düzenleme yetkiniz yok." });
    }

    var osgb = await _context.OSGBler
        .Include(o => o.OSGB_Firmalar)
        .FirstOrDefaultAsync(o => o.ApplicationUserId == userId);
    var firmaEgitim = egitim.FirmaEgitimler.FirstOrDefault();
    if (firmaEgitim == null || (osgb != null && !osgb.OSGB_Firmalar.Any(of => of.RefFirmaId == firmaEgitim.RefFirmaId))) {
        _logger.LogWarning("Kullanýcý bu etkinliði düzenleme yetkisine sahip deðil. EgitimId: {EgitimId}, FirmaId: {FirmaId}", id, firmaEgitim?.RefFirmaId);
        return Json(new { success = false, message = "Bu etkinliði düzenleme yetkiniz yok." });
    }

    return Json(new { success = true });
}

        private async Task < ApplicationUser > GetCurrentUserAsync()
{
    _logger.LogInformation("GetCurrentUserAsync çaðrýldý.");
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (string.IsNullOrEmpty(userId)) {
        _logger.LogWarning("Kullanýcý ID alýnamadý.");
        return null;
    }

    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
    _logger.LogInformation("Kullanýcý alýndý: {UserId}, Email: {Email}", user?.Id, user?.Email ?? "Bulunamadý");
    return user;
}

        private static string GetEventClass(TehlikeSinifi tehlikeSinifi)
{
    return tehlikeSinifi switch
            {
        TehlikeSinifi.AzTehlikeli => "bg-success",
        TehlikeSinifi.Tehlikeli => "bg-warning",
        TehlikeSinifi.CokTehlikeli => "bg-danger",
        _ => "bg-primary"
            };
    }

        private static string GetEventClassForEtkinlikTuru(EtkinlikTuru tur)
    {
        return tur switch
            {
            EtkinlikTuru.Etkinlik => "bg-info",
            EtkinlikTuru.Toplanti => "bg-primary",
            EtkinlikTuru.Ziyaret => "bg-warning",
            EtkinlikTuru.Diger => "bg-secondary",
            _ => "bg-info"
            };
        }
    }
}