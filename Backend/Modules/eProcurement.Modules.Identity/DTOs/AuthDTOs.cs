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

    public record CreateRoleRequest(string RoleName, string? Description);
    public record UpdateInternalUserRoleRequest(Guid InternalUserId, string Role);

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
        string? Status,
        string? ErrorMessage);

    public record InternalUserRegistrationResult(Guid InternalUserId, string Email, string Role, Guid? UnitId = null, string? UnitName = null);
    public record InternalUserRoleResult(Guid InternalUserId, string Email, string Role);

    public record RoleResult(Guid RoleId, string RoleName, string? Description, bool IsActive);
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
        IReadOnlyList<string> AllowedRoles);
}
