using eProcurement.Modules.Identity.DTOs;
using Npgsql;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    private static VendorRegistrationResult MapVendorRegistrationResult(NpgsqlDataReader r)
    {
        return new VendorRegistrationResult(
            r.GetGuid(r.GetOrdinal("vendor_id")),
            r.GetString(r.GetOrdinal("company_name")),
            r.GetString(r.GetOrdinal("email")));
    }

    private static VendorLoginResult MapVendorLoginResult(NpgsqlDataReader r)
    {
        return new VendorLoginResult(
            GetNullableGuid(r, "vendor_id"),
            GetNullableString(r, "company_name"),
            GetNullableString(r, "email"),
            GetNullableString(r, "vendor_status"),
            GetNullableString(r, "error_message"));
    }

    private static InternalLoginResult MapInternalLoginResult(NpgsqlDataReader r)
    {
        return new InternalLoginResult(
            GetNullableGuid(r, "internal_user_id"),
            GetNullableString(r, "email"),
            GetNullableString(r, "role"),
            GetNullableString(r, "status"),
            GetNullableString(r, "error_message"));
    }

    private static InternalUserRegistrationResult MapInternalUserRegistrationResult(NpgsqlDataReader r)
    {
        return new InternalUserRegistrationResult(
            r.GetGuid(r.GetOrdinal("internal_user_id")),
            r.GetString(r.GetOrdinal("email")),
            r.GetString(r.GetOrdinal("role")),
            GetNullableGuid(r, "unit_id"),
            GetNullableString(r, "unit_name"));
    }

    private static InternalUserRoleResult MapInternalUserRoleResult(NpgsqlDataReader r)
    {
        return new InternalUserRoleResult(
            r.GetGuid(r.GetOrdinal("internal_user_id")),
            r.GetString(r.GetOrdinal("email")),
            r.GetString(r.GetOrdinal("role")));
    }

    private static InternalUserProfileResult MapInternalUserProfileResult(NpgsqlDataReader r)
    {
        return new InternalUserProfileResult(
            r.GetGuid(r.GetOrdinal("internal_user_id")),
            r.GetString(r.GetOrdinal("email")),
            r.GetString(r.GetOrdinal("username")),
            r.GetString(r.GetOrdinal("first_name")),
            GetNullableString(r, "middle_name"),
            r.GetString(r.GetOrdinal("surname")),
            r.GetString(r.GetOrdinal("service_number")),
            GetNullableGuid(r, "unit_id"),
            GetNullableString(r, "unit_name"),
            r.GetString(r.GetOrdinal("role_name")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDateTime(r, "last_login"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static RoleResult MapRoleResult(NpgsqlDataReader r)
    {
        return new RoleResult(
            r.GetGuid(r.GetOrdinal("role_id")),
            r.GetString(r.GetOrdinal("role_name")),
            GetNullableString(r, "description"),
            r.GetBoolean(r.GetOrdinal("is_active")));
    }

    private static InternalOrganizationalUnitResult MapInternalOrganizationalUnitResult(NpgsqlDataReader r)
    {
        return new InternalOrganizationalUnitResult(
            r.GetGuid(r.GetOrdinal("unit_id")),
            r.GetString(r.GetOrdinal("unit_name")),
            r.GetString(r.GetOrdinal("unit_code")),
            r.GetString(r.GetOrdinal("unit_type")),
            GetNullableGuid(r, "parent_unit_id"),
            GetNullableString(r, "parent_unit_name"),
            r.GetInt32(r.GetOrdinal("sort_order")),
            r.GetBoolean(r.GetOrdinal("is_assignable")));
    }

    private static RoleModuleAccessGrantResult MapRoleModuleAccessGrantResult(NpgsqlDataReader r)
    {
        return new RoleModuleAccessGrantResult(
            r.GetString(r.GetOrdinal("role_name")),
            r.GetString(r.GetOrdinal("module_id")),
            r.GetBoolean(r.GetOrdinal("is_enabled")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static UserModuleAccessGrantResult MapUserModuleAccessGrantResult(NpgsqlDataReader r)
    {
        return new UserModuleAccessGrantResult(
            r.GetGuid(r.GetOrdinal("internal_user_id")),
            r.GetString(r.GetOrdinal("email")),
            r.GetString(r.GetOrdinal("username")),
            r.GetString(r.GetOrdinal("role_name")),
            r.GetString(r.GetOrdinal("module_id")),
            r.GetBoolean(r.GetOrdinal("is_enabled")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static ModuleAccessAuditResult MapModuleAccessAuditResult(NpgsqlDataReader r)
    {
        return new ModuleAccessAuditResult(
            r.GetGuid(r.GetOrdinal("audit_id")),
            r.GetString(r.GetOrdinal("target_type")),
            GetNullableString(r, "role_name"),
            GetNullableGuid(r, "internal_user_id"),
            GetNullableString(r, "email"),
            GetNullableString(r, "username"),
            r.GetString(r.GetOrdinal("module_id")),
            GetNullableBool(r, "previous_state"),
            GetNullableBool(r, "new_state"),
            GetNullableGuid(r, "changed_by"),
            r.GetString(r.GetOrdinal("change_source")),
            r.GetDateTime(r.GetOrdinal("changed_at")));
    }

    private static PasswordAuditResult MapPasswordAuditResult(NpgsqlDataReader r)
    {
        return new PasswordAuditResult(
            r.GetGuid(r.GetOrdinal("audit_id")),
            r.GetGuid(r.GetOrdinal("internal_user_id")),
            r.GetString(r.GetOrdinal("email")),
            r.GetString(r.GetOrdinal("action")),
            GetNullableString(r, "changed_by"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static bool? GetNullableBool(NpgsqlDataReader r, string columnName)
    {
        var ordinal = r.GetOrdinal(columnName);
        return r.IsDBNull(ordinal) ? null : r.GetBoolean(ordinal);
    }

}
