// Models/FeaturedContent.cs
namespace ilterisg.Models
{
    public class FeaturedContent
    {
        public int Id { get; set; }
        public string Section { get; set; } = string.Empty; // "LatestPosts", "RecommendedPosts", "PopularPosts"
        public int BlogPostId { get; set; }
        public BlogPost BlogPost { get; set; } = null!;
        public int DisplayOrder { get; set; } // Sıralama için
    }
}
