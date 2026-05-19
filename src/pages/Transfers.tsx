import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { CheckCircle, Download, FileText, Loader2, RefreshCw, Repeat2, Send, XCircle, X, Camera } from 'lucide-react';
import { Card, CardBody, Button, Input, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge, type BadgeVariant } from '../components/ui';
import {
  createTransfer,
  fetchDevices,
  fetchTransfers,
  receiveTransfer,
  rejectTransfer,
  cancelTransfer,
  type DeviceData,
  type TransferData,
} from '../services/api';
import { useAuth } from '../authContext';
import { exportCsv } from '../utils/exportCsv';
import { Html5Qrcode } from 'html5-qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const statusText: Record<string, string> = {
  PENDING_RECEIVE: 'Chờ khoa nhận',
  COMPLETED: 'Đã nhận',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const statusVariant = (status: string): BadgeVariant => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_RECEIVE') return 'warning';
  return 'neutral';
};

interface TransfersProps {
  defaultTab?: 'create' | 'requests' | 'history';
}

const Transfers: React.FC<TransfersProps> = ({ defaultTab = 'requests' }) => {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [transfers, setTransfers] = useState<TransferData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'requests' | 'history'>(defaultTab);
  const [transferType, setTransferType] = useState<'Cho mượn' | 'Mượn' | 'Trả'>('Cho mượn');
  const [deviceId, setDeviceId] = useState('');
  const [toDepartment, setToDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-scanner-region';

  const { username, department: userDepartment, name: userName, isAdmin } = useAuth();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [deviceData, transferData] = await Promise.all([fetchDevices(), fetchTransfers()]);
    setDevices(deviceData);
    setTransfers(transferData.reverse());
    setIsLoading(false);
    setDeviceId(current => {
      if (current || deviceData.length === 0) return current;
      const first = deviceData.find(d => isAdmin || d.department === userDepartment) || deviceData[0];
      return first.id;
    });
  }, [isAdmin, userDepartment]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    return Array.from(new Set(devices.map(d => d.department).filter(Boolean))).sort();
  }, [devices]);

  // ===== QR Scanner Logic =====
  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  const transferableDevices = useMemo(() => {
    // Show all devices — backend validates ownership/permission on submit
    return devices;
  }, [devices]);

  const startScanner = useCallback(async () => {
    setScanResult('');
    setShowScanner(true);
    // Wait for DOM element to render
    await new Promise(r => setTimeout(r, 350));
    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Found a code — match to device
          const cleanCode = decodedText.trim().toLowerCase();
          const found = transferableDevices.find(d =>
            d.id.toLowerCase() === cleanCode ||
            d.id.toLowerCase().includes(cleanCode) ||
            (d.serial && String(d.serial).toLowerCase().includes(cleanCode))
          );
          if (found) {
            setDeviceId(found.id);
            setScanResult(`✅ Đã tìm thấy: ${found.id} - ${found.name}`);
          } else {
            setScanResult(`⚠️ Không tìm thấy thiết bị với mã: ${decodedText}`);
          }
          // Stop after first successful read
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
          scannerRef.current = null;
          setTimeout(() => setShowScanner(false), 1500);
        },
        () => { /* ignore scan failures (no code in frame) */ }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setScanResult(`❌ Không thể mở camera: ${message}`);
      setTimeout(() => setShowScanner(false), 2500);
    }
  }, [transferableDevices]);

  const closeScanner = useCallback(async () => {
    await stopScanner();
    setShowScanner(false);
    setScanResult('');
  }, [stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);
  // ===== End QR Scanner =====

  const pendingRequests = transfers.filter(t => t.status === 'PENDING_RECEIVE' && (isAdmin || t.toDepartment === userDepartment || t.requestedBy === username || t.fromDepartment === userDepartment));

  const visibleTransfers = activeTab === 'requests' ? pendingRequests : transfers;

  const selectedDevice = devices.find(device => device.id === deviceId);

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    const actualToDepartment = transferType === 'Mượn' ? userDepartment : toDepartment;
    
    if (!deviceId || !actualToDepartment) {
      setMessage('Vui lòng điền đầy đủ thông tin thiết bị và khoa nhận.');
      return;
    }
    setIsSaving(true);
    const finalReason = `[${transferType}] ${reason}`;
    const response = await createTransfer({ deviceId, toDepartment: actualToDepartment, reason: finalReason, actorUsername: username });
    setIsSaving(false);
    setMessage(response.message || '');
    if (response.success) {
      setReason('');
      if (transferType === 'Cho mượn' || transferType === 'Trả') setToDepartment('');
      await loadData();
      setActiveTab('requests');
    }
  };

  const handleReceive = async (transfer: TransferData) => {
    const note = window.prompt('Ghi chú nhận thiết bị (nếu có):') || '';
    const response = await receiveTransfer({ transferId: transfer.transferId, actorUsername: username, note });
    alert(response.message || (response.success ? 'Đã nhận.' : 'Có lỗi xảy ra.'));
    await loadData();
  };

  const handleReject = async (transfer: TransferData) => {
    const reasonText = window.prompt('Lý do từ chối nhận thiết bị:') || '';
    if (!reasonText.trim()) return;
    const response = await rejectTransfer({ transferId: transfer.transferId, actorUsername: username, reason: reasonText });
    alert(response.message || (response.success ? 'Đã từ chối.' : 'Có lỗi xảy ra.'));
    await loadData();
  };

  const handleCancel = async (transfer: TransferData) => {
    if (!window.confirm('Hủy yêu cầu luân chuyển này?')) return;
    const response = await cancelTransfer({ transferId: transfer.transferId, actorUsername: username, reason: 'Người tạo yêu cầu hủy' });
    alert(response.message || (response.success ? 'Đã hủy.' : 'Có lỗi xảy ra.'));
    await loadData();
  };

  const exportRows = visibleTransfers.map((t, index) => ({
    STT: index + 1,
    'Mã yêu cầu': t.transferId,
    'Thời gian tạo': t.createdAt,
    'Mã thiết bị': t.deviceId,
    'Tên thiết bị': t.deviceName,
    'Từ khoa/phòng': t.fromDepartment,
    'Đến khoa/phòng': t.toDepartment,
    'Trạng thái': statusText[t.status] || t.status,
    'Người chuyển': t.requestedByName,
    'Người nhận': t.receivedByName,
    'Lý do/Ghi chú': t.requestedNote || t.receivedNote || t.rejectReason,
  }));

  const exportCsvFile = () => {
    if (exportRows.length === 0) return alert('Không có dữ liệu để xuất.');
    exportCsv(exportRows, `LuanChuyenThietBi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('BAO CAO LUAN CHUYEN THIET BI', 148, 18, { align: 'center' });
    autoTable(doc, {
      startY: 28,
      head: [['STT', 'Ma YC', 'Ma TB', 'Ten thiet bi', 'Tu khoa', 'Den khoa', 'Trang thai', 'Nguoi chuyen', 'Nguoi nhan']],
      body: exportRows.map(row => [
        row.STT,
        row['Mã yêu cầu'],
        row['Mã thiết bị'],
        row['Tên thiết bị'],
        row['Từ khoa/phòng'],
        row['Đến khoa/phòng'],
        row['Trạng thái'],
        row['Người chuyển'],
        row['Người nhận'],
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136], textColor: 255 },
    });
    doc.save(`LuanChuyenThietBi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Repeat2 size={28} style={{ color: 'var(--primary)' }} />
            Luân chuyển trang thiết bị
          </h1>
          <p className="dashboard-subtitle">
            Khoa đang giữ thiết bị tạo yêu cầu, khoa nhận xác nhận trước khi cập nhật vị trí thiết bị.
          </p>
        </div>
        <div className="action-buttons">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={loadData}>Làm mới</Button>
          <Button variant="secondary" icon={<FileText size={16} />} onClick={exportPdf}>PDF</Button>
          <Button variant="primary" icon={<Download size={16} />} onClick={exportCsvFile}>CSV</Button>
        </div>
      </div>

      <div className="reports-tabs-container">
        <button className={`report-main-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>Tạo yêu cầu</button>
        <button className={`report-main-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Tiếp nhận yêu cầu ({pendingRequests.length})</button>
        <button className={`report-main-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Lịch sử</button>
      </div>

      {activeTab === 'create' ? (
        <Card>
          <CardBody>
            <form onSubmit={submitTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Loại yêu cầu</label>
                <select className="filter-select" style={{ width: '100%', marginBottom: '8px' }} value={transferType} onChange={e => {
                  setTransferType(e.target.value as 'Cho mượn' | 'Mượn' | 'Trả');
                  setToDepartment('');
                }}>
                  <option value="Cho mượn">Cho mượn / Luân chuyển đi</option>
                  <option value="Mượn">Mượn thiết bị từ khoa khác</option>
                  <option value="Trả">Trả thiết bị về khoa cũ</option>
                </select>
              </div>
              <div>
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Thiết bị
                  <Button variant="secondary" size="sm" type="button" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={startScanner}>
                    <Camera size={14} style={{ marginRight: '4px' }} /> Quét QR/Barcode
                  </Button>
                </label>

                {/* ===== QR Scanner Modal ===== */}
                {showScanner && (
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }} onClick={closeScanner}>
                    <div style={{
                      background: 'var(--surface, #fff)', borderRadius: '16px', padding: '20px',
                      width: '90%', maxWidth: '420px', position: 'relative',
                    }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '1.05rem' }}>📷 Quét mã QR / Barcode</strong>
                        <button onClick={closeScanner} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <X size={20} />
                        </button>
                      </div>
                      <div id={scannerContainerId} style={{ width: '100%', minHeight: '280px', borderRadius: '8px', overflow: 'hidden' }} />
                      {scanResult && (
                        <div style={{
                          marginTop: '12px', padding: '10px', borderRadius: '8px',
                          background: scanResult.startsWith('✅') ? '#d1fae5' : scanResult.startsWith('⚠') ? '#fef3c7' : '#fee2e2',
                          fontWeight: 600, textAlign: 'center', fontSize: '0.9rem',
                        }}>
                          {scanResult}
                        </div>
                      )}
                      <p style={{ textAlign: 'center', marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        Hướng camera vào mã QR hoặc Barcode trên thiết bị
                      </p>
                    </div>
                  </div>
                )}
                {/* ===== End Scanner Modal ===== */}
                <select className="filter-select" style={{ width: '100%' }} value={deviceId} onChange={e => setDeviceId(e.target.value)} required>
                  <option value="" disabled>-- Chọn thiết bị --</option>
                  {transferableDevices.map(device => (
                    <option key={device.id} value={device.id}>{device.id} - {device.name}</option>
                  ))}
                </select>
              </div>
              <div className="info-grid">
                <div className="info-item"><span className="info-label">Vị trí thiết bị (các khoa chứa thiết bị)</span><span className="info-value">{selectedDevice?.department || '—'}</span></div>
                <div className="info-item"><span className="info-label">Người tạo yêu cầu</span><span className="info-value">{userName || username} ({userDepartment})</span></div>
              </div>
              <div>
                <label className="input-label">{transferType === 'Cho mượn' || transferType === 'Trả' ? 'Khoa/phòng nhận' : 'Chuyển về khoa (Khoa của bạn)'}</label>
                {transferType === 'Cho mượn' || transferType === 'Trả' ? (
                  <Input value={toDepartment} onChange={e => setToDepartment(e.target.value)} list="transfer-depts" placeholder="Nhập hoặc chọn khoa/phòng nhận" required />
                ) : (
                  <Input value={userDepartment} readOnly disabled required style={{ backgroundColor: 'var(--background)' }} />
                )}
                <datalist id="transfer-depts">
                  {departments.filter(dept => dept !== selectedDevice?.department).map(dept => <option key={dept} value={dept} />)}
                </datalist>
              </div>
              <div>
                <label className="input-label">Lý do</label>
                <textarea className="input-field" rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do, tình trạng bàn giao, phụ kiện đi kèm..." />
              </div>
              {message && <div style={{ color: message.startsWith('Đã') ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{message}</div>}
              <Button type="submit" variant="primary" icon={isSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />} disabled={isSaving}>
                {isSaving ? 'Đang gửi...' : 'Gửi yêu cầu sang khoa nhận'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Yêu cầu</TableHeader>
                  <TableHeader>Thiết bị</TableHeader>
                  <TableHeader>Luân chuyển</TableHeader>
                  <TableHeader>Người chuyển</TableHeader>
                  <TableHeader>Trạng thái</TableHeader>
                  <TableHeader>Thao tác</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Đang tải...</TableCell></TableRow>
                ) : visibleTransfers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Không có dữ liệu.</TableCell></TableRow>
                ) : visibleTransfers.map(transfer => (
                  <TableRow key={transfer.transferId}>
                    <TableCell><strong>{transfer.transferId}</strong><br /><small>{transfer.createdAt || transfer.requestedAt}</small></TableCell>
                    <TableCell><strong>{transfer.deviceName || transfer.deviceId}</strong><br /><small>{transfer.deviceId}</small></TableCell>
                    <TableCell>{transfer.fromDepartment}<br /><strong>→ {transfer.toDepartment}</strong></TableCell>
                    <TableCell>{transfer.requestedByName || transfer.requestedBy}<br /><small>{transfer.requestedNote}</small></TableCell>
                    <TableCell><Badge variant={statusVariant(transfer.status)}>{statusText[transfer.status] || transfer.status}</Badge></TableCell>
                    <TableCell>
                      {transfer.status === 'PENDING_RECEIVE' && (activeTab === 'requests' || isAdmin) ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(isAdmin || transfer.toDepartment === userDepartment) && (
                            <Button size="sm" variant="success" icon={<CheckCircle size={14} />} onClick={() => handleReceive(transfer)}>Nhận</Button>
                          )}
                          {(isAdmin || transfer.toDepartment === userDepartment) && (
                            <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => handleReject(transfer)}>Từ chối</Button>
                          )}
                          {(isAdmin || transfer.requestedBy === username || transfer.fromDepartment === userDepartment) && (
                             <Button size="sm" variant="secondary" onClick={() => handleCancel(transfer)}>Hủy</Button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{transfer.receivedByName || transfer.rejectReason || '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default Transfers;
