using ilterisg.Models;
using ilterisg.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace ilterisg.Controllers
{
    public class AccountController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly RoleManager<IdentityRole> _roleManager;

        public AccountController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            RoleManager<IdentityRole> roleManager)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _roleManager = roleManager;
        }

        [AllowAnonymous]
        [HttpGet]
        public IActionResult Login(string? returnUrl = null)
        {
            return View(new LoginViewModel { ReturnUrl = returnUrl });
        }

        [AllowAnonymous]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var result = await _signInManager.PasswordSignInAsync(
                model.Email,
                model.Password,
                model.RememberMe,
                lockoutOnFailure: true);

            if (result.Succeeded)
            {
                var signedInUser = await _userManager.FindByEmailAsync(model.Email);
                if (signedInUser != null &&
                    (string.IsNullOrWhiteSpace(signedInUser.FirstName) || string.IsNullOrWhiteSpace(signedInUser.LastName)))
                {
                    var missingProfileReturnUrl = returnUrl ?? model.ReturnUrl;
                    return RedirectToAction(nameof(CompleteProfile), new { returnUrl = missingProfileReturnUrl });
                }

                var safeReturnUrl = returnUrl ?? model.ReturnUrl;
                if (!string.IsNullOrWhiteSpace(safeReturnUrl) && Url.IsLocalUrl(safeReturnUrl))
                {
                    return Redirect(safeReturnUrl);
                }

                return RedirectToAction("Manage", "Blog");
            }

            if (result.IsLockedOut)
            {
                ModelState.AddModelError(string.Empty, "Hesap kilitlendi. Lutfen daha sonra tekrar deneyin.");
                return View(model);
            }

            ModelState.AddModelError(string.Empty, "E-posta veya sifre hatali.");
            return View(model);
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Index", "Home");
        }

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public IActionResult RegisterEditor()
        {
            return View(new RegisterEditorViewModel());
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RegisterEditor(RegisterEditorViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            if (!await _roleManager.RoleExistsAsync("Editor"))
            {
                await _roleManager.CreateAsync(new IdentityRole("Editor"));
            }

            var existing = await _userManager.FindByEmailAsync(model.Email);
            if (existing != null)
            {
                ModelState.AddModelError(nameof(model.Email), "Bu e-posta ile kayitli kullanici zaten var.");
                return View(model);
            }

            var user = new ApplicationUser
            {
                UserName = model.Email,
                Email = model.Email,
                EmailConfirmed = true
            };

            var createResult = await _userManager.CreateAsync(user, model.Password);
            if (!createResult.Succeeded)
            {
                foreach (var error in createResult.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }

                return View(model);
            }

            await _userManager.AddToRoleAsync(user, "Editor");
            TempData["SuccessMessage"] = "Editor hesabi olusturuldu.";
            return RedirectToAction(nameof(RegisterEditor));
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> CompleteProfile(string? returnUrl = null)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction(nameof(Login));
            }

            var vm = new CompleteProfileViewModel
            {
                FirstName = user.FirstName ?? string.Empty,
                LastName = user.LastName ?? string.Empty,
                ReturnUrl = returnUrl
            };

            if (string.IsNullOrWhiteSpace(vm.FirstName) || string.IsNullOrWhiteSpace(vm.LastName))
            {
                var (derivedFirstName, derivedLastName) = DeriveNamePartsFromEmail(user.Email);
                vm.FirstName ??= derivedFirstName;
                vm.LastName ??= derivedLastName;
            }

            return View(vm);
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CompleteProfile(CompleteProfileViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction(nameof(Login));
            }

            user.FirstName = model.FirstName.Trim();
            user.LastName = model.LastName.Trim();

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                foreach (var error in updateResult.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }

                return View(model);
            }

            if (!string.IsNullOrWhiteSpace(model.ReturnUrl) && Url.IsLocalUrl(model.ReturnUrl))
            {
                return Redirect(model.ReturnUrl);
            }

            return RedirectToAction("Manage", "Blog");
        }

        [AllowAnonymous]
        [HttpGet]
        public IActionResult AccessDenied()
        {
            return View();
        }

        private static (string FirstName, string LastName) DeriveNamePartsFromEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return ("Editor", "User");
            }

            var local = email.Split('@')[0];
            var parts = local
                .Replace('-', '.')
                .Replace('_', '.')
                .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (parts.Length == 0)
            {
                return ("Editor", "User");
            }

            if (parts.Length == 1)
            {
                return (Capitalize(parts[0]), "User");
            }

            return (Capitalize(parts[0]), Capitalize(parts[^1]));
        }

        private static string Capitalize(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return "User";
            }

            var lowered = value.ToLowerInvariant();
            return char.ToUpperInvariant(lowered[0]) + lowered[1..];
        }
    }
}
