using System.Text.RegularExpressions;
using eProcurement.Modules.Identity.Services;
using eProcurement.Shared.Configurations;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Security;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace eProcurement.Modules.Identity.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class AuthController : BaseModuleController
    {
        private const int InternalPasswordMinLength = 8;
        private const string VendorAuthCookieName = "vendorAuthToken";
        private const string InternalAuthCookieName = "internalAuthToken";
        private static readonly Regex HasUppercase = new("[A-Z]", RegexOptions.Compiled);
        private static readonly Regex HasLowercase = new("[a-z]", RegexOptions.Compiled);
        private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);
        private static readonly Regex HasSymbol = new("[^a-zA-Z0-9]", RegexOptions.Compiled);
        private static readonly Regex UsernamePattern = new("^[A-Za-z0-9._-]{3,100}$", RegexOptions.Compiled);
        private static readonly Regex NamePattern = new("^[A-Za-z][A-Za-z' -]{0,99}$", RegexOptions.Compiled);
        private static readonly Regex ServiceNumberPattern = new("^[A-Za-z0-9/-]{3,100}$", RegexOptions.Compiled);
        private static readonly Regex PhoneNumberPattern = new(@"^\+?[0-9 ()-]{7,20}$", RegexOptions.Compiled);

        private readonly WorkflowActionGrantService _workflowActionGrantService;
        private readonly InternalSessionActivityProtector _internalSessionActivityProtector;
        private readonly InternalSessionOptions _internalSessionOptions;

        public AuthController(
            IConfiguration config,
            ILogger<AuthController> logger,
            WorkflowActionGrantService workflowActionGrantService,
            InternalSessionActivityProtector internalSessionActivityProtector,
            IOptions<InternalSessionOptions> internalSessionOptions)
            : base(config, logger)
        {
            _workflowActionGrantService = workflowActionGrantService;
            _internalSessionActivityProtector = internalSessionActivityProtector;
            _internalSessionOptions = internalSessionOptions.Value;
        }
    }
}
