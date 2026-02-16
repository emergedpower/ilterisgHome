using System.ComponentModel.DataAnnotations;

namespace ilterisg.Models
{
    public class BlogComment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int BlogPostId { get; set; }

        [Required]
        [MaxLength(120)]
        public string AuthorName { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string CommentText { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
