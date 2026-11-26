import { Outlet } from 'react-router-dom';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { ManagerUpdates } from '@/features/system/ManagerUpdates';

export function RootShell() {
  return (
    <div className="app-content">
      <NotificationContainer />
      <ConfirmationModal />
      <ManagerUpdates>
        <Outlet />
      </ManagerUpdates>
    </div>
  );
}
