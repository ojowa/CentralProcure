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
}
