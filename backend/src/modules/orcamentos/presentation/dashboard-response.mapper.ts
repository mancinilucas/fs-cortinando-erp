import type {
  DashboardView,
  InstallationListItem,
} from '../application/queries/dashboard-read-model.js';
import type {
  DashboardInstallationResponseDto,
  DashboardResponseDto,
} from './dto/dashboard-response.dto.js';

// Translates the dashboard read model to the public JSON contract (D237). The
// projection is closed: no phone, financial values or additional keys.
export class DashboardResponseMapper {
  static toResponse(view: DashboardView): DashboardResponseDto {
    return {
      statusCounts: {
        draft: view.statusCounts.draft,
        sent: view.statusCounts.sent,
        expired: view.statusCounts.expired,
        confirmed: view.statusCounts.confirmed,
        inProduction: view.statusCounts.inProduction,
      },
      upcomingInstallations: view.upcomingInstallations.map(toInstallation),
      weeklyInstallations: view.weeklyInstallations.map(toInstallation),
      overdueInstallations: view.overdueInstallations.map(toInstallation),
    };
  }
}

function toInstallation(
  item: InstallationListItem,
): DashboardInstallationResponseDto {
  return {
    quoteId: item.quoteId,
    quoteNumber: item.quoteNumber,
    customerName: item.customerName,
    scheduledInstallationAt: item.scheduledInstallationAt.toISOString(),
    status: item.status,
  };
}
