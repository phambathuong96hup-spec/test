import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Activity,
  AlertTriangle,
  Download,
  ShieldAlert
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, Badge, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Button } from '../components/ui';
import { fetchDevices, fetchRepairs, updateDocumentStatus, type DeviceData, type RepairData } from '../services/api';
import { useAuth } from '../authContext';
import { registerViFont } from '../utils/pdfFont';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dashboard: React.FC = () => {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [repairs, setRepairs] = useState<RepairData[]>([]);
  const [repairCount, setRepairCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [devData, repData] = await Promise.all([fetchDevices(), fetchRepairs()]);
      setDevices(devData);
      setRepairs(repData);
      setRepairCount(repData.filter(r => !r.status.toLowerCase().includes('hoàn')).length);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const getDepartmentStats = () => {
    const deptCount: Record<string, number> = {};
    devices.forEach(d => {
      let dept = d.department ? d.department.trim() : 'Khác';
      if (dept === '') dept = 'Khác';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    });
    const sorted = Object.entries(deptCount).sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const others = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
    const labels = top4.map(item => item[0]);
    const data = top4.map(item => item[1]);
    if (others > 0) { labels.push('Khác'); data.push(others); }
    return { labels, data };
  };

  // Helper: Tính toán lịch bảo dưỡng/đăng kiểm theo yêu cầu
  const parseVietnameseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const processedDevices = devices.map(d => {
    const deadlineStr = String(d['Thời hạn cấp lại/ Hạn đăng kiểm'] || d['Ngày bảo dưỡng tiếp theo'] || '');
    const prepDaysStr = String(d['Thời gian  chuẩn bị Hồ sơ'] || d['Thời gian chuẩn bị Hồ sơ'] || '');
    
    let daysRemaining = 999;
    let warningLevel = 'safe'; // safe, warning, danger, critical
    let alertText = '';
    const parsedDeadline = parseVietnameseDate(deadlineStr);
    
    if (parsedDeadline) {
      const prepDays = parseInt(prepDaysStr) || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const deadlineTime = parsedDeadline.getTime();
      const prepStartTime = deadlineTime - (prepDays * 24 * 60 * 60 * 1000);
      
      const diffStart = Math.ceil((prepStartTime - today.getTime()) / (1000 * 60 * 60 * 24));
      const diffDeadline = Math.ceil((deadlineTime - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDeadline < 0) {
        warningLevel = 'critical';
        alertText = `Quá hạn Đăng kiểm ${Math.abs(diffDeadline)} ngày`;
      } else if (diffStart <= 0) {
        warningLevel = 'danger';
        alertText = `Tới hạn chuẩn bị hồ sơ (còn ${diffDeadline} ngày đăng kiểm)`;
      } else if (diffStart <= 5) {
         warningLevel = 'warning';
         alertText = `Còn ${diffStart} ngày bắt đầu làm hồ sơ`;
      }
      daysRemaining = diffStart <= 5 ? diffStart : diffDeadline;
    }

    const docStatus = d['Trạng thái Hồ sơ'] || '';
    if (docStatus === 'Đã gửi' && warningLevel !== 'safe') {
      warningLevel = 'success';
      alertText = 'Đã gửi hồ sơ';
    }

    return {
      ...d,
      deadlineDate: parsedDeadline ? parsedDeadline.toLocaleDateString('vi-VN') : 'Không rõ',
      warningLevel,
      alertText,
      daysRemaining
    };
  });

  const handleDocStatusUpdate = async (serial: string) => {
    if (!isAdmin) {
      alert('Chỉ tài khoản Admin được cập nhật trạng thái hồ sơ.');
      return;
    }
    setUpdatingId(serial);
    const res = await updateDocumentStatus(serial, 'Đã gửi');
    if (res && res.success) {
      setDevices(prev => prev.map(d => d.id === serial ? { ...d, 'Trạng thái Hồ sơ': 'Đã gửi' } : d));
    } else {
      alert('Có lỗi xảy ra: ' + (res?.message || ''));
    }
    setUpdatingId(null);
  };

  const maintenanceAlerts = processedDevices
    .filter(d => d.warningLevel !== 'safe')
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const { labels: pieLabels, data: pieDataValues } = getDepartmentStats();

  const pieDataConfig = {
    labels: pieLabels.length > 0 ? pieLabels : ['Chưa có dữ liệu'],
    datasets: [{
      data: pieDataValues.length > 0 ? pieDataValues : [1],
      backgroundColor: ['#0d9488', '#3b82f6', '#f59e0b', '#e11d48', '#94a3b8'],
      borderWidth: 0,
    }],
  };

  const getRepairStatsByMonth = () => {
    const monthStats = new Array(12).fill(0);
    const thisYear = new Date().getFullYear();
    repairs.forEach(r => {
      if (!r.rowId) return;
      const parts = r.rowId.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (parts) {
        const month = parts[2];
        const year = parts[3];
        if (parseInt(year) === thisYear) {
          monthStats[parseInt(month) - 1]++;
        }
      }
    });

    return {
      labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      datasets: [
        {
          label: `Số ca báo hỏng/sửa chữa năm ${thisYear}`,
          data: monthStats,
          backgroundColor: '#0d9488',
          borderRadius: 6
        }
      ]
    };
  };

  const barData = getRepairStatsByMonth();
  const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const } } };

  const handleExportPDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerViFont(doc);
    doc.setFontSize(14);
    doc.setFont(doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica', 'bold');
    doc.text('BÁO CÁO TỔNG QUAN HỆ THỐNG QLTTB', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica', 'normal');
    doc.text('Trung tâm Y tế khu vực Thanh Ba', 105, 28, { align: 'center' });
    doc.text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, 105, 35, { align: 'center' });

    autoTable(doc, {
      startY: 42,
      head: [['Chỉ số', 'Số liệu']],
      body: [
        ['Tổng số TB quản lý', `${devices.length} máy`],
        ['Đang hoạt động tốt', `${devices.length - repairCount} máy`],
        ['Báo hỏng / chờ sửa', `${repairCount} yêu cầu`],
        ['Cảnh báo đăng kiểm', `${maintenanceAlerts.length} thiết bị`],
      ],
      styles: { fontSize: 11, cellPadding: 4, font: doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica' },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
    });

    const deptStats = getDepartmentStats();
    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12,
      head: [['Khoa/Phòng', 'Số lượng thiết bị']],
      body: deptStats.labels.map((l, i) => [l, deptStats.data[i]]),
      styles: { fontSize: 10, font: doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica' },
      headStyles: { fillColor: [13, 148, 136], textColor: 255 },
    });

    doc.save(`TongQuan_QLTTB_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tổng quan Hệ thống</h1>
          <p className="dashboard-subtitle">Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}, {new Date().toLocaleDateString('vi-VN')}</p>
        </div>
        <Button variant="secondary" icon={<Download size={18} />} onClick={handleExportPDF}>Xuất báo cáo PDF</Button>
      </div>

      <div className="stats-grid">
        <Card className="stat-card gradient-blue">
          <div className="stat-icon"><Stethoscope size={28} /></div>
          <div className="stat-info">
            <span className="stat-value">{isLoading ? '...' : devices.length}</span>
            <span className="stat-label">Thiết bị quản lý</span>
          </div>
        </Card>
        <Card className="stat-card gradient-teal">
          <div className="stat-icon"><Activity size={28} /></div>
          <div className="stat-info">
            <span className="stat-value">{isLoading ? '...' : Math.max(0, devices.length - repairCount)}</span>
            <span className="stat-label">Hoạt động ổn định</span>
          </div>
        </Card>
        <Card className="stat-card gradient-orange">
          <div className="stat-icon"><AlertTriangle size={28} /></div>
          <div className="stat-info">
            <span className="stat-value">{isLoading ? '...' : repairCount}</span>
            <span className="stat-label">Đang báo hỏng/chờ sửa</span>
          </div>
        </Card>
        <Card className="stat-card gradient-rose">
          <div className="stat-icon"><ShieldAlert size={28} /></div>
          <div className="stat-info">
            <span className="stat-value">{isLoading ? '...' : maintenanceAlerts.length}</span>
            <span className="stat-label">Cảnh báo Đăng kiểm</span>
          </div>
        </Card>
      </div>

      <div className="charts-grid">
        <Card>
          <CardHeader title="Phân bổ thiết bị theo Khoa/Phòng" />
          <CardBody>
            <div className="chart-container">
              {isLoading
                ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>Đang tải biểu đồ...</div>
                : <Pie data={pieDataConfig} options={{ maintainAspectRatio: false }} />
              }
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Thống kê báo hỏng & sửa chữa năm nay" />
          <CardBody>
            <div className="chart-container">
              {isLoading
                ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>Đang tải biểu đồ...</div>
                : <Bar data={barData} options={barOptions} />
              }
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="lists-grid">
        <Card>
          <CardHeader
            title={<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>Yêu cầu báo hỏng {repairCount > 0 && <Badge variant="danger">{repairCount} đang chờ</Badge>}</div>}
            action={<Button variant="secondary" size="sm" onClick={() => navigate(isAdmin ? '/admin-repairs' : '/requests?type=repair')}>Xem tất cả</Button>}
          />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Mã thiết bị</TableHeader>
                <TableHeader>Mô tả lỗi</TableHeader>
                <TableHeader>Trạng thái</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>Đang tải...</TableCell></TableRow>
                : repairCount === 0
                  ? <TableRow><TableCell colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: 'var(--success)' }}>Không có yêu cầu nào đang chờ.</TableCell></TableRow>
                  : repairs.filter(r => !r.status.toLowerCase().includes('hoàn')).slice(0, 5).map((repair, idx) => (
                    <TableRow key={`repair-${repair.rowId}-${idx}`}>
                      <TableCell><strong>{repair.deviceId}</strong></TableCell>
                      <TableCell style={{ maxWidth: '200px', whiteSpace: 'normal' }}>{repair.description}</TableCell>
                      <TableCell><Badge variant={repair.status.toLowerCase().includes('chờ') ? 'warning' : 'primary'}>{repair.status}</Badge></TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            title={<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>Cảnh báo Hồ sơ / Đăng kiểm {maintenanceAlerts.length > 0 && <Badge variant="danger">{maintenanceAlerts.length}</Badge>}</div>}
            action={<Button variant="secondary" size="sm" onClick={() => navigate('/devices')}>Tất cả thiết bị</Button>}
          />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Thiết bị</TableHeader>
                <TableHeader>Hạn Đăng kiểm</TableHeader>
                <TableHeader>Cảnh báo</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>Đang tải...</TableCell></TableRow>
                : maintenanceAlerts.length === 0
                  ? <TableRow><TableCell colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: 'var(--success)', fontWeight:'bold' }}>Mọi thiết bị đều đang trong hạn an toàn.</TableCell></TableRow>
                  : maintenanceAlerts.map((device) => (
                    <TableRow key={`maint-${device.id}`} className={`alert-row-${device.warningLevel}`}>
                      <TableCell><strong style={device.warningLevel === 'critical' ? {color:'white'}:{}}>{device.name}</strong><br/><small>{device.id}</small></TableCell>
                      <TableCell>{device.deadlineDate}</TableCell>
                      <TableCell>
                        <strong style={device.warningLevel === 'critical' ? {color:'white'}:{}}>{device.alertText}</strong>
                        {isAdmin && device.warningLevel !== 'success' && (
                          <div style={{ marginTop: '8px' }}>
                            <Button 
                              size="sm" 
                              variant={device.warningLevel === 'critical' ? 'secondary' : 'primary'} 
                              onClick={() => handleDocStatusUpdate(device.id)} 
                              disabled={updatingId === device.id}
                            >
                               {updatingId === device.id ? 'Đang gửi...' : 'Đã gửi hồ sơ'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
