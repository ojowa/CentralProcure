using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.DTOs;

public sealed record TenderWorkflowDisplayResponse(
    Guid TenderId,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    WorkflowRuntimeDisplay? WorkflowDisplay);
