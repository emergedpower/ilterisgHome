namespace ilterisg.Models
{
    public class UpdateFeaturedContentDto
    {
        public string Section { get; set; } = string.Empty;
        public int BlogPostId { get; set; }
        public int DisplayOrder { get; set; }
    }
}
