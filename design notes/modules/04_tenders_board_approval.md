# Proposal 4: Tenders Board Approval Workspace

## 1. Goal
Provide the **Tenders Board Secretary** and **CGIS** a dashboard to review evaluation recommendations and grant final award approval.

## 2. PPA 2007 Control Requirements
- **Quorum Check:** The system should log which board members reviewed the case.
- **Decision Logic:** Allow 'Approved', 'Rejected', or 'Returned for Re-evaluation'.
- **Threshold Guard:** If the award value exceeds the agency's threshold, the system must force an **Escalation to BPP** instead of final approval.

## 3. UI Flow
- **Approval Queue:** List all tenders with completed evaluations.
- **Review View:** Display the **Evaluation Report** and **Bid Opening Record** side-by-side.
- **Decision Form:** Capture the Tenders Board's final verdict and justification.
