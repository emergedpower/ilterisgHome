namespace ilterisg.Models.ViewModels
{
    public class AdminUsersViewModel
    {
        public IReadOnlyList<AdminUserListItemViewModel> Users { get; init; } = Array.Empty<AdminUserListItemViewModel>();

        public int AdminCount { get; init; }

        public int EditorCount { get; init; }

        public int ActiveCount { get; init; }
    }
}
