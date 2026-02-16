using ilterisg.Data;
using ilterisg.Helpers;
using ilterisg.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using System.Data;
using System.Globalization;
using System.Security.Authentication;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options =>
{
    options.ConfigureHttpsDefaults(https =>
    {
        https.SslProtocols = SslProtocols.Tls13 | SslProtocols.Tls12;
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:DefaultConnection tanımlı değil.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(
        connectionString,
        sqliteOptions => sqliteOptions.MigrationsHistoryTable("__efmigrationshistory")));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;

    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "IlterISGHome.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.SlidingExpiration = true;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.LoginPath = "/Account/Login";
    options.AccessDeniedPath = "/Account/AccessDenied";
});

builder.Services.AddAuthorization();
builder.Services.AddMemoryCache();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var supportedCultures = new[] { "tr-TR", "en-US", "de-DE" }
        .Select(c => new CultureInfo(c))
        .ToList();

    options.DefaultRequestCulture = new Microsoft.AspNetCore.Localization.RequestCulture("tr-TR");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;
    options.RequestCultureProviders.Insert(0, new Microsoft.AspNetCore.Localization.CookieRequestCultureProvider());
});

builder.Services
    .AddControllersWithViews()
    .AddViewLocalization(Microsoft.AspNetCore.Mvc.Razor.LanguageViewLocationExpanderFormat.Suffix)
    .AddDataAnnotationsLocalization();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.Name = "__Host-IlterISG.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
    options.Cookie.IsEssential = true;
});

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    options.MinimumSameSitePolicy = SameSiteMode.Strict;
    options.HttpOnly = Microsoft.AspNetCore.CookiePolicy.HttpOnlyPolicy.Always;
    options.Secure = CookieSecurePolicy.Always;
});

builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("ContactForm", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });

    options.OnRejected = async (context, cancellationToken) =>
    {
        var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "text/plain; charset=utf-8";
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsync(
            localizer["RateLimitExceeded"].Value ?? "Çok fazla istek gönderdiniz. Lütfen tekrar deneyin.",
            cancellationToken);
    };
});

builder.Services.AddTransient<IEmailService, EmailService>();

var app = builder.Build();

await SeedIdentityAndSchemaAsync(app);

app.Lifetime.ApplicationStarted.Register(() =>
{
    var startupLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("StartupUrls");

    if (app.Urls.Count == 0)
    {
        startupLogger.LogWarning("No bound URLs were found.");
        return;
    }

    foreach (var url in app.Urls)
    {
        startupLogger.LogInformation("Listening on: {Url}", url);
    }
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCookiePolicy();

app.UseRequestLocalization(app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>().Value);

app.UseRouting();
app.UseSession();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var path = context.Request.Path;
        var allowedPaths = new[]
        {
            "/Account/Login",
            "/Account/Logout",
            "/Account/CompleteProfile",
            "/Account/AccessDenied"
        };

        if (!allowedPaths.Any(x => path.StartsWithSegments(x, StringComparison.OrdinalIgnoreCase)))
        {
            var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.GetUserAsync(context.User);

            if (user != null && (string.IsNullOrWhiteSpace(user.FirstName) || string.IsNullOrWhiteSpace(user.LastName)))
            {
                var returnUrl = Uri.EscapeDataString($"{context.Request.Path}{context.Request.QueryString}");
                context.Response.Redirect($"/Account/CompleteProfile?returnUrl={returnUrl}");
                return;
            }
        }
    }

    await next();
});

app.MapControllerRoute(
    name: "blog_index",
    pattern: "Blog",
    defaults: new { controller = "Blog", action = "Index" });

app.MapControllerRoute(
    name: "blog_details",
    pattern: "Blog/{id:int}/{slug?}",
    defaults: new { controller = "Blog", action = "Details" });

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

static async Task SeedIdentityAndSchemaAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeed");
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    await BaselineInitialSqliteMigrationIfNeededAsync(context, logger);
    //await context.Database.MigrateAsync();

    var roles = new[] { "Admin", "Editor" };
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    var createDefaultUsers = app.Configuration.GetValue("IdentitySeed:CreateDefaultUsers", true);
    if (!createDefaultUsers)
    {
        return;
    }

    var adminEmail = app.Configuration["IdentitySeed:AdminEmail"];
    var adminPassword = app.Configuration["IdentitySeed:AdminPassword"];
    var editorEmail = app.Configuration["IdentitySeed:EditorEmail"];
    var editorPassword = app.Configuration["IdentitySeed:EditorPassword"];

    await EnsureUserAsync(userManager, logger, adminEmail, adminPassword, "Admin");
    await EnsureUserAsync(userManager, logger, editorEmail, editorPassword, "Editor");
}

static async Task BaselineInitialSqliteMigrationIfNeededAsync(AppDbContext context, ILogger logger)
{
    if (!context.Database.IsSqlite())
    {
        return;
    }

    var allMigrations = context.Database.GetMigrations().ToArray();
    if (allMigrations.Length == 0)
    {
        return;
    }

    var initialMigration = allMigrations[0];
    var pendingMigrations = (await context.Database.GetPendingMigrationsAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
    if (!pendingMigrations.Contains(initialMigration))
    {
        return;
    }

    var identityTablesExist = await SqliteTableExistsAsync(context, "aspnetroles")
        && await SqliteTableExistsAsync(context, "aspnetusers");

    if (!identityTablesExist)
    {
        return;
    }

    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "__efmigrationshistory" (
            "MigrationId" TEXT NOT NULL CONSTRAINT "PK___efmigrationshistory" PRIMARY KEY,
            "ProductVersion" TEXT NOT NULL
        );
        """);

    const string efProductVersion = "8.0.18";
    var insertedRowCount = await context.Database.ExecuteSqlInterpolatedAsync($"""
        INSERT OR IGNORE INTO "__efmigrationshistory" ("MigrationId", "ProductVersion")
        VALUES ({initialMigration}, {efProductVersion});
        """);

    if (insertedRowCount > 0)
    {
        logger.LogWarning(
            "Legacy SQLite schema detected. Initial migration {MigrationId} was marked as applied to prevent duplicate table creation.",
            initialMigration);
    }
}

static async Task<bool> SqliteTableExistsAsync(AppDbContext context, string tableName)
{
    var connection = context.Database.GetDbConnection();
    var shouldCloseConnection = connection.State != ConnectionState.Open;

    if (shouldCloseConnection)
    {
        await connection.OpenAsync();
    }

    try
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $name LIMIT 1;";

        var tableNameParameter = command.CreateParameter();
        tableNameParameter.ParameterName = "$name";
        tableNameParameter.Value = tableName;
        command.Parameters.Add(tableNameParameter);

        var queryResult = await command.ExecuteScalarAsync();
        return queryResult != null && queryResult != DBNull.Value;
    }
    finally
    {
        if (shouldCloseConnection)
        {
            await connection.CloseAsync();
        }
    }
}

static async Task EnsureUserAsync(
    UserManager<ApplicationUser> userManager,
    ILogger logger,
    string? email,
    string? password,
    string role)
{
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        logger.LogWarning("IdentitySeed atlandı. {Role} için e-posta/şifre eksik.", role);
        return;
    }

    var user = await userManager.FindByEmailAsync(email);
    if (user == null)
    {
        user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            logger.LogError(
                "Kullanıcı oluşturulamadı. Role={Role}, Email={Email}, Errors={Errors}",
                role,
                email,
                string.Join("; ", createResult.Errors.Select(e => e.Description)));
            return;
        }
    }

    if (!await userManager.IsInRoleAsync(user, role))
    {
        await userManager.AddToRoleAsync(user, role);
    }
}
