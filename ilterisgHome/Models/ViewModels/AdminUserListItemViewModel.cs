namespace ilterisg.Models.ViewModels
{
    public class AdminUserListItemViewModel
    {
        public string Id { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public bool IsAdmin { get; set; }

        public bool IsEditor { get; set; }

        public bool IsActive { get; set; }

        public bool CanDeleteEditor { get; set; }
    }
}
