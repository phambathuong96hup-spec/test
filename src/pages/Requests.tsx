import React, { Suspense, lazy } from 'react';
import { ClipboardPlus, Repeat2, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import './Reports.css';

const RepairRequest = lazy(() => import('./RepairRequest'));
const Transfers = lazy(() => import('./Transfers'));

type RequestType = 'repair' | 'transfer';

const requestTypes: Array<{
  type: RequestType;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    type: 'repair',
    label: 'Báo hỏng / sửa chữa',
    description: 'Tạo yêu cầu kiểm tra, sửa chữa hoặc theo dõi xử lý thiết bị hỏng.',
    icon: Wrench,
  },
  {
    type: 'transfer',
    label: 'Luân chuyển thiết bị',
    description: 'Tạo yêu cầu cho mượn, mượn hoặc trả thiết bị giữa các khoa/phòng.',
    icon: Repeat2,
  },
];

const Requests: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeType: RequestType = searchParams.get('type') === 'transfer' ? 'transfer' : 'repair';

  const selectType = (type: RequestType) => {
    setSearchParams({ type }, { replace: true });
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardPlus size={28} style={{ color: 'var(--primary)' }} />
            Tạo yêu cầu
          </h1>
          <p className="dashboard-subtitle">
            Tạo và theo dõi các yêu cầu nghiệp vụ liên quan đến trang thiết bị.
          </p>
        </div>
      </div>

      <div className="reports-tabs-container" style={{ marginBottom: '20px' }}>
        {requestTypes.map(item => {
          const Icon = item.icon;
          const active = activeType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              className={`report-main-tab ${active ? 'active' : ''}`}
              onClick={() => selectType(item.type)}
              title={item.description}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Đang tải biểu mẫu...</div>}>
        {activeType === 'transfer'
          ? <Transfers defaultTab="create" />
          : <RepairRequest defaultTab="create" />}
      </Suspense>
    </div>
  );
};

export default Requests;
