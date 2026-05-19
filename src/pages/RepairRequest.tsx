import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Camera, AlertCircle, Clock, Send, X, ShieldAlert, ChevronDown, ScanLine,
  CheckCircle, XCircle, Download, FileText, Loader2, RefreshCw, Wrench, Search
} from 'lucide-react';
import { Card, CardBody, Button, Input, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge, type BadgeVariant } from '../components/ui';
import { reportRepair, fetchDevices, fetchRepairs, approveRepair, type DeviceData, type RepairData } from '../services/api';
import { useAuth } from '../authContext';
import { exportCsv } from '../utils/exportCsv';
import { Html5QrcodeScanner } from 'html5-qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './RepairRequest.css';

const repairStatusText: Record<string, string> = {
  'Chờ duyệt': 'Chờ duyệt',
  'Đã duyệt': 'Đã duyệt',
  'Từ chối': 'Từ chối',
  'Đang kiểm tra': 'Đang kiểm tra',
  'Đang sửa chữa': 'Đang sửa chữa',
  'Đã hoàn thành': 'Đã hoàn thành',
};

const repairStatusVariant = (status: string): BadgeVariant => {
  const s = status.toLowerCase();
  if (s.includes('hoàn thành') || s.includes('đã duyệt')) return 'success';
  if (s.includes('từ chối')) return 'danger';
  if (s.includes('chờ') || s.includes('kiểm tra')) return 'warning';
  if (s.includes('sửa')) return 'primary';
  return 'neutral';
};

interface RepairRequestProps {
  defaultTab?: 'create' | 'requests' | 'history';
}

const RepairRequest: React.FC<RepairRequestProps> = ({ defaultTab = 'requests' }) => {
  // ===== Tab state =====
  const [activeTab, setActiveTab] = useState<'create' | 'requests' | 'history'>(defaultTab);

  // ===== Create form state =====
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');

  // ===== Repairs data =====
  const [repairs, setRepairs] = useState<RepairData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ===== Auth =====
  const { name, email, department, isAdmin } = useAuth();
  const userName = name || 'Nhân viên vô danh';
  const userDepartment = department || '';
  const [userEmail, setUserEmail] = useState(email);

  // ===== Load data =====
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [deviceData, repairData] = await Promise.all([fetchDevices(), fetchRepairs()]);
    setDevices(deviceData);
    setRepairs(repairData.reverse());
    setIsLoading(false);

    // Pre-fill device from sessionStorage if redirected from DeviceProfile
    const prefilledId = sessionStorage.getItem('repairDeviceId');
    setDeviceId(current => {
      if (prefilledId) return prefilledId;
      return current || deviceData[0]?.id || '';
    });
    if (prefilledId) sessionStorage.removeItem('repairDeviceId');
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (email) setUserEmail(email);
  }, [email]);

  // ===== Pending repairs (chờ duyệt) =====
  const pendingRepairs = useMemo(() =>
    repairs.filter(r => {
      const s = r.status.toLowerCase();
      return s.includes('chờ') || s.includes('kiểm tra') || s.includes('sửa');
    }),
    [repairs]
  );

  const visibleRepairs = activeTab === 'requests' ? pendingRepairs : repairs;

  // ===== QR Scanner =====
  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render((decodedText) => {
        let newId = '';
        try {
          if (decodedText.includes('/devices/')) {
            const pathParts = decodedText.split('/devices/');
            if (pathParts.length > 1) {
              const urlId = pathParts[1].split('?')[0].split('#')[0];
              newId = decodeURIComponent(urlId).trim();
            }
          } else {
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.id) newId = parsed.id;
            } catch {
              const match = decodedText.match(/MÃ THIẾT BỊ:\s*([^\n]+)/i);
              if (match) newId = match[1].trim();
              else newId = decodedText.trim();
            }
          }
        } catch {
          newId = decodedText.trim();
        }

        if (newId) {
          setDeviceId(newId);
          setIsScanning(false);
          scanner.clear();
          alert(`Đã nhận diện thiết bị: ${newId}`);
        }
      }, () => { /* ignore */ });

      return () => {
        scanner.clear().catch(e => console.error("Scanner clear fail", e));
      };
    }
  }, [isScanning]);

  // ===== Image upload =====
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== Submit repair =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !userEmail.trim() || !deviceId.trim()) {
      setMessage('Vui lòng điền đầy đủ Mã thiết bị, Mô tả và Email.');
      return;
    }
    setIsSubmitting(true);

    const response = await reportRepair({
      deviceId: priority === 'urgent' ? `[KHẨN] ${deviceId}` : deviceId,
      userName,
      userEmail,
      description,
    });

    setIsSubmitting(false);

    if (response.success) {
      setMessage('✅ Yêu cầu báo hỏng đã được gửi thành công!');
      setDescription('');
      setSelectedImage(null);
      setPriority('normal');
      if (devices.length > 0) setDeviceId(devices[0].id);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
      setTimeout(() => setActiveTab('requests'), 1500);
    } else {
      setMessage('❌ Có lỗi xảy ra: ' + (response.message || 'Lỗi không xác định'));
    }
  };

  // ===== Approve/Reject repair =====
  const handleApproveRepair = async (repair: RepairData) => {
    if (!isAdmin) return alert('Bạn không có quyền duyệt yêu cầu sửa chữa.');
    const note = window.prompt('Ghi chú duyệt (nếu có):') || '';
    const res = await approveRepair({
      rowId: repair.rowId,
      deviceId: repair.deviceId,
      newStatus: 'Đã duyệt',
      approver: userName,
      note,
    });
    alert(res.message || (res.success ? 'Đã đồng ý xử lý.' : 'Có lỗi xảy ra.'));
    await loadData();
  };

  const handleRejectRepair = async (repair: RepairData) => {
    if (!isAdmin) return alert('Bạn không có quyền từ chối yêu cầu sửa chữa.');
    const reasonText = window.prompt('Lý do từ chối báo hỏng/sửa chữa:') || '';
    if (!reasonText.trim()) return;
    const res = await approveRepair({
      rowId: repair.rowId,
      deviceId: repair.deviceId,
      newStatus: 'Từ chối',
      approver: userName,
      note: reasonText,
    });
    alert(res.message || (res.success ? 'Đã từ chối.' : 'Có lỗi xảy ra.'));
    await loadData();
  };

  const handleStatusChange = async (repair: RepairData, newStatus: string) => {
    if (!isAdmin) return alert('Bạn không có quyền cập nhật tiến độ sửa chữa.');
    if (!newStatus) return;
    if (!window.confirm(`Xác nhận cập nhật trạng thái "${repair.deviceId}" thành "${newStatus}"?`)) return;

    // Optimistic update
    setRepairs(prev => prev.map(r =>
      r.rowId === repair.rowId ? { ...r, status: newStatus } : r
    ));

    const res = await approveRepair({
      rowId: repair.rowId,
      deviceId: repair.deviceId,
      newStatus,
      approver: userName,
      note: '',
    });

    if (!res.success) {
      alert("Lỗi khi cập nhật: " + res.message);
      await loadData();
    }
  };

  // ===== Export =====
  const exportRows = visibleRepairs.map((r, index) => ({
    STT: index + 1,
    'Thời gian': r.rowId,
    'Mã thiết bị': r.deviceId,
    'Người báo': r.userName,
    'Email': r.userEmail,
    'Mô tả lỗi': r.description,
    'Trạng thái': r.status,
  }));

  const exportCsvFile = () => {
    if (exportRows.length === 0) return alert('Không có dữ liệu để xuất.');
    exportCsv(exportRows, `BaoHong_SuaChua_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('BAO CAO BAO HONG / SUA CHUA', 148, 18, { align: 'center' });
    autoTable(doc, {
      startY: 28,
      head: [['STT', 'Thoi gian', 'Ma TB', 'Nguoi bao', 'Mo ta loi', 'Trang thai']],
      body: exportRows.map(row => [
        row.STT, row['Thời gian'], row['Mã thiết bị'], row['Người báo'],
        row['Mô tả lỗi'], row['Trạng thái'],
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136], textColor: 255 },
    });
    doc.save(`BaoHong_SuaChua_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`);
  };

  const statusOptions = ['Chờ duyệt', 'Đã duyệt', 'Đang kiểm tra', 'Đang sửa chữa', 'Đã hoàn thành', 'Từ chối'];

  return (
    <div className="reports-page">
      {/* ===== Page Header ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={28} style={{ color: 'var(--danger)' }} />
            Báo hỏng / Sửa chữa
          </h1>
          <p className="dashboard-subtitle">
            Gửi yêu cầu báo hỏng, theo dõi tiến độ xử lý, duyệt hoặc từ chối yêu cầu sửa chữa.
          </p>
        </div>
        <div className="action-buttons">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={loadData}>Làm mới</Button>
          <Button variant="secondary" icon={<FileText size={16} />} onClick={exportPdf}>PDF</Button>
          <Button variant="primary" icon={<Download size={16} />} onClick={exportCsvFile}>CSV</Button>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="reports-tabs-container">
        <button className={`report-main-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
          Tạo yêu cầu
        </button>
        <button className={`report-main-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          Tiếp nhận yêu cầu ({pendingRepairs.length})
        </button>
        <button className={`report-main-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          Lịch sử
        </button>
      </div>

      {/* ===== Tab: Tạo yêu cầu ===== */}
      {activeTab === 'create' ? (
        <Card>
          <CardBody>
            {/* Device selector */}
            <div className="device-summary">
              <div className="device-summary-icon">
                <ShieldAlert size={28} style={{ color: 'var(--danger)' }} />
              </div>
              <div className="device-summary-info" style={{ flex: 1 }}>
                <h3>Chọn thiết bị báo hỏng</h3>
                <div style={{ position: 'relative' }}>
                  <select
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 36px 10px 14px',
                      border: '1.5px solid var(--border)', borderRadius: '8px',
                      fontSize: '0.95rem', background: 'white', appearance: 'none',
                      cursor: 'pointer', color: 'var(--text-primary)'
                    }}
                  >
                    {devices.length === 0
                      ? <option value="">Đang tải danh sách thiết bị...</option>
                      : devices.map(d => (
                          <option key={d.id} value={d.id}>{d.id} — {d.name} ({d.department})</option>
                        ))
                    }
                  </select>
                  <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Hoặc nhập tay mã thiết bị:
                </p>
                <input
                  type="text"
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                  placeholder="Nhập tay mã TB nếu không có trong danh sách"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', marginTop: '4px', boxSizing: 'border-box' }}
                />

                <div style={{ marginTop: '12px' }}>
                  <Button type="button" variant={isScanning ? "danger" : "secondary"} icon={<ScanLine size={18} />} onClick={() => setIsScanning(!isScanning)}>
                    {isScanning ? 'Đóng máy quét' : 'Quét mã QR trên thiết bị'}
                  </Button>
                </div>

                {isScanning && (
                  <div style={{ marginTop: '16px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                    <div id="qr-reader" style={{ width: '100%' }}></div>
                  </div>
                )}
              </div>
            </div>

            <form className="form-section" onSubmit={handleSubmit}>
              {/* Info grid: vị trí & người báo */}
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Vị trí thiết bị</span>
                  <span className="info-value">{devices.find(d => d.id === deviceId)?.department || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Người tạo yêu cầu</span>
                  <span className="info-value">{userName} ({userDepartment})</span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Mức độ ưu tiên</label>
                <div className="priority-options">
                  <label className={`radio-card ${priority === 'normal' ? 'selected' : ''}`} onClick={() => setPriority('normal')}>
                    <input type="radio" name="priority" value="normal" checked={priority === 'normal'} onChange={() => setPriority('normal')} />
                    <div className="radio-label"><Clock size={24} /><span>Bình thường</span></div>
                  </label>
                  <label className={`radio-card urgent ${priority === 'urgent' ? 'selected' : ''}`} onClick={() => setPriority('urgent')}>
                    <input type="radio" name="priority" value="urgent" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} />
                    <div className="radio-label"><AlertCircle size={24} /><span>Khẩn cấp</span></div>
                  </label>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Mô tả tình trạng hỏng hóc</label>
                <div className="input-wrapper">
                  <textarea
                    className="input-field"
                    placeholder="Mô tả chi tiết biểu hiện lỗi (VD: Máy không lên nguồn, màn hình báo lỗi E02...)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Email của bạn (Nhận kết quả phản hồi)</label>
                <Input
                  type="email"
                  placeholder="VD: nhanvien@benhvien.vn"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  readOnly={email !== ''}
                  style={{ backgroundColor: email !== '' ? 'var(--surface-50)' : 'white' }}
                  required
                />
                {email !== ''
                  ? <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>* Email được đồng bộ từ tài khoản của bạn.</p>
                  : <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>* Nhờ Admin cập nhật Email trong Sheet Users để tự động điền.</p>
                }
              </div>

              <div className="input-group">
                <label className="input-label">Hình ảnh đính kèm (tùy chọn)</label>
                {!selectedImage ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ cursor: 'pointer', border: '2px dashed #c2dbe9', borderRadius: '8px', padding: '24px', textAlign: 'center', background: '#f8fbff' }}
                  >
                    <Camera size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Nhấn để chọn ảnh tình trạng máy</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: '100%', maxWidth: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={selectedImage} alt="Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    <button type="button" onClick={handleRemoveImage}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>

              {message && (
                <div style={{
                  color: message.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 600,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: message.startsWith('✅') ? 'var(--success-light)' : 'var(--danger-light)',
                }}>
                  {message}
                </div>
              )}

              <Button type="submit" variant="primary" className="submit-btn" icon={isSubmitting ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={20} />} disabled={isSubmitting}>
                {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu sửa chữa'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        /* ===== Tab: Tiếp nhận yêu cầu / Lịch sử ===== */
        <Card>
          <CardBody style={{ padding: 0 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Thời gian</TableHeader>
                  <TableHeader>Thiết bị</TableHeader>
                  <TableHeader>Người báo</TableHeader>
                  <TableHeader>Mô tả lỗi</TableHeader>
                  <TableHeader>Trạng thái</TableHeader>
                  <TableHeader>Thao tác</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Đang tải...</TableCell></TableRow>
                ) : visibleRepairs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Không có dữ liệu.</TableCell></TableRow>
                ) : visibleRepairs.map((repair, index) => {
                  const isCompleted = repair.status.toLowerCase().includes('hoàn thành');
                  const isRejected = repair.status.toLowerCase().includes('từ chối');
                  const isPending = repair.status.toLowerCase().includes('chờ');
                  const isDone = isCompleted || isRejected;

                  return (
                    <TableRow key={`${repair.rowId}-${index}`}>
                      <TableCell>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', opacity: isDone ? 0.7 : 1 }}>
                          {repair.rowId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <strong style={{ opacity: isDone ? 0.7 : 1 }}>
                          {repair.deviceId}
                        </strong>
                      </TableCell>
                      <TableCell>
                        <div style={{ opacity: isDone ? 0.7 : 1, display: 'flex', flexDirection: 'column' }}>
                          <span>{repair.userName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{repair.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span style={{
                          opacity: isDone ? 0.7 : 1,
                          maxWidth: '300px', whiteSpace: 'normal', display: 'inline-block'
                        }}>
                          {repair.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={repairStatusVariant(repair.status)}>
                          {isCompleted ? <CheckCircle size={12} /> :
                            isRejected ? <XCircle size={12} /> :
                            repair.status.toLowerCase().includes('sửa') ? <Wrench size={12} /> :
                            isPending ? <Clock size={12} /> :
                            <Search size={12} />
                          }
                          <span style={{ marginLeft: '4px' }}>{repairStatusText[repair.status] || repair.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {activeTab === 'requests' && !isDone ? (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Approve / Reject buttons for pending */}
                            {isPending && isAdmin && (
                              <>
                                <Button size="sm" variant="success" icon={<CheckCircle size={14} />} onClick={() => handleApproveRepair(repair)}>
                                  Đồng ý
                                </Button>
                                <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => handleRejectRepair(repair)}>
                                  Không đồng ý
                                </Button>
                              </>
                            )}
                            {/* Status change dropdown for in-progress items */}
                            {isAdmin && !isPending && (
                              <select
                                value={statusOptions.includes(repair.status) ? repair.status : ''}
                                onChange={(e) => handleStatusChange(repair, e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1.5px solid var(--border)',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  outline: 'none',
                                  color: 'var(--text-primary)',
                                  minWidth: '130px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                              >
                                <option value="" disabled>-- Cập nhật --</option>
                                {statusOptions.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {repair.status}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default RepairRequest;
