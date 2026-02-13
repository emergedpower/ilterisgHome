using System.ComponentModel.DataAnnotations;

namespace ilterisg.Models.ViewModels
{
    public class CompleteProfileViewModel
    {
        [Required(ErrorMessage = "Ad zorunludur.")]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Soyad zorunludur.")]
        [MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        public string? ReturnUrl { get; set; }
    }
}
