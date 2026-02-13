using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ilterisg.Models
{
    public class BlogPost
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public bool IsPublished { get; set; } = true;

        // 👍 Görsel için
        [MaxLength(500)]
        public string? ImageUrl { get; set; }

        // 👍 Özet (opsiyonel ama önerilir)
        [MaxLength(500)]
        public string? Summary { get; set; }

        // 👍 Popülerlik takibi için
        public int ViewCount { get; set; } = 0;

        [MaxLength(70)]
        public string? MetaTitle { get; set; }

        [MaxLength(160)]
        public string? MetaDescription { get; set; }

        [MaxLength(300)]
        public string? MetaKeywords { get; set; }

        [MaxLength(220)]
        public string? Slug { get; set; }

        // 👤 Kullanıcı bilgileri
        [BindNever]
        [MaxLength(450)]
        public string AuthorUserId { get; set; } = string.Empty;

        [BindNever]
        [ForeignKey(nameof(AuthorUserId))]
        public virtual ApplicationUser Author { get; set; } = null!;
    }
}
