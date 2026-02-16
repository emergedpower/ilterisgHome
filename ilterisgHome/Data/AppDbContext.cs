using ilterisg.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ilterisg.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
        public DbSet<BlogComment> BlogComments => Set<BlogComment>();
        public DbSet<FeaturedContent> FeaturedContents => Set<FeaturedContent>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUser>().ToTable("aspnetusers");
            builder.Entity<IdentityRole>().ToTable("aspnetroles");
            builder.Entity<IdentityUserRole<string>>().ToTable("aspnetuserroles");
            builder.Entity<IdentityUserClaim<string>>().ToTable("aspnetuserclaims");
            builder.Entity<IdentityUserLogin<string>>().ToTable("aspnetuserlogins");
            builder.Entity<IdentityRoleClaim<string>>().ToTable("aspnetroleclaims");
            builder.Entity<IdentityUserToken<string>>().ToTable("aspnetusertokens");

            builder.Entity<BlogPost>().ToTable("blogposts");
            builder.Entity<BlogComment>().ToTable("blogcomments");
            builder.Entity<FeaturedContent>().ToTable("featuredcontents");

            builder.Entity<BlogPost>()
                .HasOne(p => p.Author)
                .WithMany()
                .HasForeignKey(p => p.AuthorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<BlogComment>()
                .HasOne<BlogPost>()
                .WithMany()
                .HasForeignKey(c => c.BlogPostId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<BlogComment>()
                .Property(c => c.AuthorName)
                .HasMaxLength(120);

            builder.Entity<BlogComment>()
                .Property(c => c.CommentText)
                .HasMaxLength(2000);

            builder.Entity<BlogComment>()
                .HasIndex(c => c.BlogPostId);

            builder.Entity<BlogPost>()
                .Property(p => p.MetaTitle)
                .HasMaxLength(70);

            builder.Entity<BlogPost>()
                .Property(p => p.MetaDescription)
                .HasMaxLength(160);

            builder.Entity<BlogPost>()
                .Property(p => p.MetaKeywords)
                .HasMaxLength(300);

            builder.Entity<BlogPost>()
                .Property(p => p.Slug)
                .HasMaxLength(220);

            builder.Entity<BlogPost>()
                .HasIndex(p => p.Slug);

            builder.Entity<FeaturedContent>()
                .HasOne(fc => fc.BlogPost)
                .WithMany()
                .HasForeignKey(fc => fc.BlogPostId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<FeaturedContent>()
                .Property(fc => fc.Section)
                .HasMaxLength(100);

            builder.Entity<FeaturedContent>()
                .HasIndex(fc => new { fc.Section, fc.BlogPostId })
                .IsUnique();
        }
    }
}
