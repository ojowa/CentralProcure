import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { systemRouter } from './routes/system.js';
import { vendorRouter } from './routes/vendor.js';
import { vendorAdminRouter } from './routes/vendor-admin.js';
import { tendersRouter } from './routes/tenders.js';
import { tendersPublicRouter } from './routes/tenders-public.js';
import { bidsRouter } from './routes/bids.js';
import { bidOpeningRouter } from './routes/bid-opening.js';
import { evaluationsRouter } from './routes/evaluations.js';
import { evaluationReportsRouter } from './routes/evaluation-reports.js';
import { procurementPlansRouter } from './routes/procurement-plans.js';
import { procurementPlanItemsRouter } from './routes/procurement-plan-items.js';
import { yearlyAppsRouter } from './routes/yearly-apps.js';
import { planningCommitteeRouter } from './routes/planning-committee.js';
import { needsCollectionRouter } from './routes/needs-collection.js';
import { procurementMethodsRouter } from './routes/procurement-methods.js';
import { bppNoObjectionsRouter } from './routes/bpp-no-objections.js';
import { administrativeReviewsRouter } from './routes/administrative-reviews.js';
import { tendersBoardApprovalsRouter } from './routes/tenders-board-approvals.js';
import { contractsRouter } from './routes/contracts.js';
import { inspectionsRouter } from './routes/inspections.js';
import { paymentsRouter } from './routes/payments.js';
import { budgetRouter } from './routes/budget.js';
import { auditRouter } from './routes/audit.js';
import { approvalThresholdsRouter } from './routes/approval-thresholds.js';
import { monitoringRouter } from './routes/monitoring.js';
import { workflowRouter } from './routes/workflow.js';
import { workflowConfigRouter } from './routes/workflow-config.js';
import { cgisApprovalRouter } from './routes/cgis-approval.js';
import { dashboardRouter } from './routes/dashboard.js';
import { errorHandler } from './middleware/error-handler.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { authMiddleware } from './middleware/auth.js';
import { securityStampMiddleware } from './middleware/security-stamp.js';
import { sessionIdleTimeoutMiddleware } from './middleware/session-idle.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.allowedOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use(csrfMiddleware);
  app.use(authMiddleware);
  app.use(securityStampMiddleware);
  app.use(sessionIdleTimeoutMiddleware);

  app.use(systemRouter);
  app.use(authRouter);
  app.use(vendorRouter);
  app.use(vendorAdminRouter);
  app.use(tendersRouter);
  app.use(tendersPublicRouter);
  app.use(bidsRouter);
  app.use(bidOpeningRouter);
  app.use(evaluationsRouter);
  app.use(evaluationReportsRouter);
  app.use(procurementPlansRouter);
  app.use(procurementPlanItemsRouter);
  app.use(yearlyAppsRouter);
  app.use(planningCommitteeRouter);
  app.use(needsCollectionRouter);
  app.use(procurementMethodsRouter);
  app.use(bppNoObjectionsRouter);
  app.use(administrativeReviewsRouter);
  app.use(tendersBoardApprovalsRouter);
  app.use(contractsRouter);
  app.use(inspectionsRouter);
  app.use(paymentsRouter);
  app.use(budgetRouter);
  app.use(auditRouter);
  app.use(approvalThresholdsRouter);
  app.use(monitoringRouter);
  app.use(workflowRouter);
  app.use(workflowConfigRouter);
  app.use(cgisApprovalRouter);
  app.use(dashboardRouter);

  app.use(errorHandler);

  return app;
};
