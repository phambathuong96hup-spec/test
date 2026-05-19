import React, { useState, useEffect } from 'react';
import { fetchRepairs, approveRepair, type RepairData } from '../services/api';
import { Card, CardHeader, CardBody, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge } from '../components/ui';
import { CheckCircle, Clock, Search, Wrench, Edit } from 'lucide-react';
import { useAuth } from '../authContext';

const AdminRepairs: React.FC = () => {
  const { name } = useAuth();
  const [repairs, setRepairs] = useState<RepairData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchRepairs();
    setRepairs(data.reverse());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (rowId: string, deviceId: string, newStatus: string) => {
    if (!newStatus || newStatus === '') return;
    if (!window.confirm(`Xác nhận cập nhật trạng thái thiết bị ${deviceId} thành "${newStatus}"?`)) {
      return;
    }
    
    // Cập nhật UI tạm thời
    setRepairs(prev => prev.map(r => 
      r.rowId === rowId ? { ...r, status: newStatus } : r
    ));

    const res = await approveRepair({
      rowId,
      deviceId,
      newStatus,
      approver: name,
    });

    if (!res.success) {
      alert("Lỗi khi cập nhật trên máy chủ: " + res.message);
      loadData();
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('hoàn thành')) return 'success';
    if (s.includes('sửa')) return 'primary';
    if (s.includes('kiểm tra') || s.includes('chờ')) return 'warning';
    return 'neutral';
  };

  const statusOptions = ['Đang kiểm tra', 'Đang sửa chữa', 'Đã hoàn thành'];

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Edit size={28} style={{ color: 'var(--primary)' }} />
          Cập nhật Tiến độ Sửa chữa
        </h1>
        <p className="dashboard-subtitle">Thay đổi trạng thái yêu cầu báo hỏng trực tiếp để mọi người cùng theo dõi</p>
      </div>

      <Card>
        <CardHeader title="Danh sách các Yêu cầu (Mới nhất nằm trên cùng)" />
        <CardBody style={{ padding: '0' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Thời gian báo</TableHeader>
                <TableHeader>Thiết bị</TableHeader>
                <TableHeader>Người báo</TableHeader>
                <TableHeader>Mô tả lỗi</TableHeader>
                <TableHeader>Trạng thái hiện tại</TableHeader>
                <TableHeader>Cập nhật trạng thái</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách yêu cầu...</TableCell></TableRow>
              ) : repairs.length === 0 ? (
                <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chưa có yêu cầu báo hỏng nào.</TableCell></TableRow>
              ) : (
                repairs.map((rp, index) => {
                  const isCompleted = rp.status.toLowerCase().includes('hoàn thành');
                  return (
                    <TableRow key={index} className={isCompleted ? 'completed-row' : ''}>
                      <TableCell>
                        <span style={{ opacity: isCompleted ? 0.7 : 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rp.rowId}</span>
                      </TableCell>
                      <TableCell>
                        <span style={{ opacity: isCompleted ? 0.7 : 1, fontWeight: '600' }}>{rp.deviceId}</span>
                      </TableCell>
                      <TableCell>
                        <div style={{ opacity: isCompleted ? 0.7 : 1, display: 'flex', flexDirection: 'column' }}>
                          <span>{rp.userName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rp.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <span style={{ opacity: isCompleted ? 0.7 : 1, maxWidth: '300px', whiteSpace: 'normal', display: 'inline-block' }}>{rp.description}</span>
                      </TableCell>
                      <TableCell>
                        <div style={{ opacity: isCompleted ? 0.7 : 1 }}>
                          <Badge variant={getStatusBadgeVariant(rp.status)}>
                            {isCompleted ? <CheckCircle size={12}/> : (rp.status.toLowerCase().includes('sửa') ? <Wrench size={12}/> : (rp.status.toLowerCase().includes('trạng thái') ? <Clock size={12}/> : <Search size={12}/>))}
                            <span style={{marginLeft: '4px'}}>{rp.status}</span>
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <select 
                          value={statusOptions.includes(rp.status) ? rp.status : (isCompleted ? "Đã hoàn thành" : "")}
                          onChange={(e) => handleStatusChange(rp.rowId, rp.deviceId, e.target.value)}
                          disabled={isCompleted}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--border)',
                            background: isCompleted ? 'var(--surface-50)' : '#fff',
                            cursor: isCompleted ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            minWidth: '140px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <option value="" disabled>-- Chọn trạng thái --</option>
                          {statusOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
};

export default AdminRepairs;
