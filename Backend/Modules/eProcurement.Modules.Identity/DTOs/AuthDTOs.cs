using System;

namespace eProcurement.Modules.Identity.DTOs
{
    public record LoginRequest(string Email, string Password);
    public record InternalLoginRequest(string Email, string Password);

    public record VendorRegistrationRequest(
        string Email,
        string Password,
        string CompanyName,
        string? RegistrationNumber = null,
        string? TaxID = null,
        string? CompanyAddress = "",
        string? ContactPerson = "",
        string? PhoneNumber = "");

    public record InternalUserRegistrationRequest(
        string Email,
        string Password,
        string Username,
        string FirstName,
        string? MiddleName,
        string Surname,
        string ServiceNumber,
        Guid? UnitId,
        string? Role = "Internal");

    public record UpdateInternalUserRequest(
        string Email,
        string Username,
        string FirstName,
        string? MiddleName,
        string Surname,
        string ServiceNumber,
        Guid? UnitId,
        bool IsActive);

    public record UpdateUserStatusRequest(string Status, bool IsActive);

    public record AdminResetPasswordRequest(string NewPassword, bool RequireChangeOnNextLogin = true);

    public record SelfPasswordResetRequest(string CurrentPassword, string NewPassword);

    public record CreateRoleRequest(string RoleName, string? Description);

    public record UpdateRoleRequest(string RoleName, string? Description);

    public record UpdateInternalUserRoleRequest
    {
        public Guid? InternalUserId { get; init; }
        public string Role { get; init; } = string.Empty;
    }

    public record UpdateRoleModuleAccessRequest(string RoleName, string ModuleId, bool IsEnabled);

    public record ManageInternalOrganizationalUnitRequest(
        Guid? UnitId,
        string UnitCode,
        string UnitName,
        string UnitType,
        Guid? ParentUnitId,
        int SortOrder,
        bool IsAssignable,
        bool IsActive);

    public record UpdateUserModuleAccessRequest(Guid InternalUserId, string ModuleId, bool IsEnabled);

    public record ModuleAccessGrantInput(string ModuleId, bool IsEnabled);

    public record BulkRoleModuleAccessRequest(string RoleName, IReadOnlyList<ModuleAccessGrantInput> Grants);

    public record BulkUserModuleAccessRequest(Guid InternalUserId, IReadOnlyList<ModuleAccessGrantInput> Grants);

    public record AuthResponse(string Token, string Email, string Status, string? Role = null);

    public record VendorRegistrationResult(Guid VendorId, string CompanyName, string Email);

    public record VendorLoginResult(
        Guid? VendorId,
        string? CompanyName,
        string? Email,
        string? VendorStatus,
        string? ErrorMessage);

    public record InternalLoginResult(
        Guid? InternalUserId,
        string? Email,
        string? Role,
        string? CanonicalRoleKey,
        string? Status,
        string? ErrorMessage);

    public record InternalUserRegistrationResult(Guid InternalUserId, string Email, string Role, Guid? UnitId = null, string? UnitName = null);

    public record InternalUserRoleResult(Guid InternalUserId, string Email, string Role, string CanonicalRoleKey);

    public record InternalUserProfileResult(
        Guid InternalUserId,
        string Email,
        string Username,
        string FirstName,
        string? MiddleName,
        string Surname,
        string ServiceNumber,
        Guid? UnitId,
        string? UnitName,
        string RoleName,
        string CanonicalRoleKey,
        string Status,
        DateTime? LastLogin,
        DateTime CreatedAt);

    public record UpdateInternalUserProfileRequest(
        string Username,
        string FirstName,
        string? MiddleName,
        string Surname);

    public record RoleResult(Guid RoleId, string RoleName, string CanonicalRoleKey, string? Description, bool IsActive);

    public record RoleDetailResult(Guid RoleId, string RoleName, string? Description, bool IsActive, int UserCount);

    public record RoleUserResult(Guid InternalUserId, string Email, string Username, string FirstName, string Surname, string Status);

    public record InternalOrganizationalUnitResult(
        Guid UnitId,
        string UnitName,
        string UnitCode,
        string UnitType,
        Guid? ParentUnitId,
        string? ParentUnitName,
        int SortOrder,
        bool IsAssignable);

    public record InternalModuleResult(
        string Id,
        string Title,
        string Section,
        string Description,
        string Microservice,
        string ControlPurpose,
        IReadOnlyList<string> Actions,
        IReadOnlyList<string> CatalogActions,
        string GrantSource = "catalog_role",
        bool IsVisible = true,
        bool HasRoleOverride = false,
        bool HasUserOverride = false);

    public record RoleModuleAccessGrantResult(
        string RoleName,
        string ModuleId,
        bool IsEnabled,
        DateTime UpdatedAt);

    public record UserModuleAccessGrantResult(
        Guid InternalUserId,
        string Email,
        string Username,
        string RoleName,
        string ModuleId,
        bool IsEnabled,
        DateTime UpdatedAt);

    public record ModuleAccessAuditResult(
        Guid AuditId,
        string TargetType,
        string? RoleName,
        Guid? InternalUserId,
        string? Email,
        string? Username,
        string ModuleId,
        bool? PreviousState,
        bool? NewState,
        Guid? ChangedBy,
        string ChangeSource,
        DateTime ChangedAt);

    public record PasswordAuditResult(
        Guid AuditId,
        Guid InternalUserId,
        string Email,
        string Action,
        string? ChangedBy,
        DateTime ChangedAt);
}
