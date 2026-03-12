namespace eProcurement.Modules.Identity.Data
{
    using Microsoft.EntityFrameworkCore;
    // using eProcurement.Modules.Identity.Models;

    public class IdentityDbContext : DbContext
    {
        public IdentityDbContext(DbContextOptions<IdentityDbContext> options) : base(options)
        {
        }

        // public DbSet<Vendor> Vendors { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            // Configure PostgreSQL UUIDs, etc.
        }
    }
}
