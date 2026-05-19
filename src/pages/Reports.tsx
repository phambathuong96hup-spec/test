import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, Activity, CheckCircle, ShieldCheck } from 'lucide-react';
import { Card, CardBody, Button, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge } from '../components/ui';
import { fetchDevices, fetchRepairs, type DeviceData, type RepairData } from '../services/api';
import { exportCsv, type CsvRow } from '../utils/exportCsv';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerViFont } from '../utils/pdfFont';
import './Reports.css';

const Reports: React.FC = () => {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [repairs, setRepairs] = useState<RepairData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeMainTab, setActiveMainTab] = useState<'thong-ke' | 'bao-cao'>('thong-ke');
  const [subTab, setSubTab] = useState<'sua-xong' | 'kiem-dinh'>('sua-xong');

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [devData, repData] = await Promise.all([fetchDevices(), fetchRepairs()]);
      setDevices(devData);
      setRepairs(repData);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const isDateInRange = (dateStr: string) => {
    if (!dateStr) return true;
    const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!parts) return true;
    const [ , day, month, year ] = parts;
    const rDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const fDate = new Date(fromDate); fDate.setHours(0, 0, 0, 0);
    const tDate = new Date(toDate); tDate.setHours(23, 59, 59, 999);
    return rDate >= fDate && rDate <= tDate;
  };

  const activeRepairs = repairs.filter(r => !r.status.toLowerCase().includes('hoàn') && isDateInRange(r.rowId));
  const completedRepairs = repairs.filter(r => r.status.toLowerCase().includes('hoàn') && isDateInRange(r.rowId));

  const getDeviceDetails = (id: string) => devices.find(d => d.id === id);

  const handleExportCsv = () => {
    let exportData: CsvRow[] = [];
    if (activeMainTab === 'thong-ke') {
      if (activeRepairs.length === 0) return alert('Không có dữ liệu.');
      exportData = activeRepairs.map((r, i) => {
        const d = getDeviceDetails(r.deviceId);
        return { STT: i+1, 'Ngày báo hỏng': r.rowId, 'Thiết bị': d ? d.name : 'Unknown', 'Mô tả lỗi': r.description, 'Tình trạng': r.status };
      });
    } else {
      if (subTab === 'sua-xong') {
        if (completedRepairs.length === 0) return alert('Không có dữ liệu.');
        exportData = completedRepairs.map((r, i) => {
          const d = getDeviceDetails(r.deviceId);
          return { STT: i+1, 'Ngày hoàn thành': r.rowId, 'Thiết bị': d ? d.name : 'Unknown', 'Mô tả': r.description, 'Trạng thái': r.status };
        });
      } else {
        if (devices.length === 0) return alert('Không có dữ liệu.');
        exportData = devices.map((d, i) => ({
          STT: i+1, 'Mã TB': d.id, 'Tên thiết bị': d.name, 'Khoa/Phòng': d.department, 'Ngày đăng kiểm': d['Ngày cấp/ Ngày Đăng kiểm'] || '', 'Bảo dưỡng tiếp theo': d['Ngày bảo dưỡng tiếp theo'] || ''
        }));
      }
    }
    exportCsv(exportData, `BaoCao_${activeMainTab}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    await registerViFont(doc);
    const fontName = doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica';
    doc.setFontSize(14); doc.setFont(fontName, 'bold');
    
    let title = 'BÁO CÁO THỐNG KÊ';
    let headers: string[][] = [];
    let body: (string | number)[][] = [];

    if (activeMainTab === 'thong-ke') {
      title = 'THỐNG KÊ THIẾT BỊ ĐANG HỎNG HÓC';
      headers = [['STT', 'Ngày báo', 'Mã TB', 'Tên Thiết Bị', 'Khoa/Phòng', 'Mô tả lỗi', 'Trạng thái']];
      body = activeRepairs.map((r, i) => {
        const d = getDeviceDetails(r.deviceId);
        return [i+1, r.rowId, r.deviceId, d ? d.name : '', d ? d.department : '', r.description.substring(0,40), r.status];
      });
    } else {
      if (subTab === 'sua-xong') {
        title = 'BÁO CÁO THIẾT BỊ ĐÃ SỬA XONG';
        headers = [['STT', 'Ngày hoàn thành', 'Mã TB', 'Tên Thiết Bị', 'Thông tin sửa', 'Trạng thái']];
        body = completedRepairs.map((r, i) => {
          const d = getDeviceDetails(r.deviceId);
          return [i+1, r.rowId, r.deviceId, d ? d.name : '', r.description.substring(0,40), r.status];
        });
      } else {
        title = 'BÁO CÁO KIỂM ĐỊNH CHUNG';
        headers = [['STT', 'Mã TB', 'Tên Thiết Bị', 'Khoa/Phòng', 'Ngày Cấp/Đăng kiểm', 'Bảo dưỡng tiếp theo']];
        body = devices.map((d, i) => [i + 1, d.id, d.name, d.department, String(d['Ngày cấp/ Ngày Đăng kiểm'] || 'N/A'), String(d['Ngày bảo dưỡng tiếp theo'] || 'N/A')]);
      }
    }

    doc.text(title, 148, 18, { align: 'center' });
    doc.setFontSize(10); doc.setFont(fontName, 'normal');
    if (activeMainTab === 'thong-ke' || subTab === 'sua-xong') {
      doc.text(`Từ ngày: ${fromDate}   Đến ngày: ${toDate}`, 148, 26, { align: 'center' });
    }

    autoTable(doc, {
      startY: 32,
      head: headers,
      body: body.length > 0 ? body : [['Không có dữ liệu báo cáo', '', '', '', '', '', '']],
      styles: { fontSize: 9, cellPadding: 3, font: fontName },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Trang ${i}/${pageCount} - In lúc: ${new Date().toLocaleString('vi-VN')}`, 148, 200, { align: 'center' });
    }

    doc.save(`${title.replace(/ /g, '_')}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1 className="page-title">Thống kê & Báo cáo</h1>
        <p className="page-subtitle">Quản lý và theo dõi tình trạng thiết bị y tế tổng thể</p>
      </div>

      <div className="reports-tabs-container">
        <div className={`report-main-tab ${activeMainTab === 'thong-ke' ? 'active' : ''}`} onClick={() => setActiveMainTab('thong-ke')}>
          <Activity size={20} />
          <span>Thống kê Thiết bị</span>
        </div>
        <div className={`report-main-tab ${activeMainTab === 'bao-cao' ? 'active' : ''}`} onClick={() => setActiveMainTab('bao-cao')}>
          <FileText size={20} />
          <span>Báo cáo Tổng hợp</span>
        </div>
      </div>

      <Card className="report-content-card">
        <CardBody style={{ padding: '24px' }}>
          
          <div className="report-toolbar">
            {(activeMainTab === 'thong-ke' || (activeMainTab === 'bao-cao' && subTab === 'sua-xong')) && (
              <div className="date-pickers">
                <div className="date-picker-wrapper">
                  <span className="date-label">Từ:</span>
                  <input type="date" className="date-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div className="date-picker-wrapper">
                  <span className="date-label">Đến:</span>
                  <input type="date" className="date-input" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
            )}
            
            {activeMainTab === 'bao-cao' && (
              <div className="sub-tabs-container">
                <button className={`sub-tab-btn ${subTab === 'sua-xong' ? 'active' : ''}`} onClick={() => setSubTab('sua-xong')}>
                  <CheckCircle size={16} /> Báo cáo sửa xong
                </button>
                <button className={`sub-tab-btn ${subTab === 'kiem-dinh' ? 'active' : ''}`} onClick={() => setSubTab('kiem-dinh')}>
                  <ShieldCheck size={16} /> Kiểm định chung
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>In</Button>
              <Button variant="secondary" icon={<FileText size={16} />} onClick={handleExportPDF}>Tải PDF</Button>
              <Button variant="primary" icon={<Download size={16} />} onClick={handleExportCsv}>Tải CSV</Button>
            </div>
          </div>

          <div className="report-table-wrapper" style={{ marginTop: '24px' }}>
            
            {/* THỐNG KÊ (ĐANG HỎNG) */}
            {activeMainTab === 'thong-ke' && (
              <>
                <h3 style={{ marginBottom: '16px', color: 'var(--primary-dark)', fontSize: '1.2rem', fontWeight: 600 }}>
                  Thống kê Thiết bị Đang gặp sự cố ({activeRepairs.length})
                </h3>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Ngày báo hỏng</TableHeader>
                      <TableHeader>Thiết bị</TableHeader>
                      <TableHeader>Người báo</TableHeader>
                      <TableHeader>Tình trạng / Lỗi</TableHeader>
                      <TableHeader>Trạng thái</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? <TableRow><TableCell colSpan={5} style={{textAlign:'center', padding: '2rem'}}>Đang tải...</TableCell></TableRow> : 
                     activeRepairs.length === 0 ? <TableRow><TableCell colSpan={5} style={{textAlign:'center', padding: '2rem'}}>Không có thiết bị hỏng trong kỳ.</TableCell></TableRow> :
                     activeRepairs.map((r, i) => {
                       const d = getDeviceDetails(r.deviceId);
                       return (
                         <TableRow key={i}>
                           <TableCell style={{color:'var(--text-secondary)'}}>{r.rowId}</TableCell>
                           <TableCell><strong>{d ? d.name : r.deviceId}</strong><br/><small>{d?.department}</small></TableCell>
                           <TableCell>{r.userName}</TableCell>
                           <TableCell>{r.description}</TableCell>
                           <TableCell><Badge variant="warning">{r.status}</Badge></TableCell>
                         </TableRow>
                       );
                     })
                    }
                  </TableBody>
                </Table>
              </>
            )}

            {/* BÁO CÁO SỬA XONG */}
            {activeMainTab === 'bao-cao' && subTab === 'sua-xong' && (
              <>
                <h3 style={{ marginBottom: '16px', color: 'var(--success)', fontSize: '1.2rem', fontWeight: 600 }}>
                  Báo cáo Thiết bị Đã sửa xong ({completedRepairs.length})
                </h3>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Ngày hoàn thành</TableHeader>
                      <TableHeader>Thiết bị</TableHeader>
                      <TableHeader>Tiến độ / Ghi chú</TableHeader>
                      <TableHeader>Trạng thái</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? <TableRow><TableCell colSpan={5} style={{textAlign:'center', padding: '2rem'}}>Đang tải...</TableCell></TableRow> : 
                     completedRepairs.length === 0 ? <TableRow><TableCell colSpan={5} style={{textAlign:'center', padding: '2rem'}}>Chưa có thiết bị hoàn thành sửa chữa trong kỳ.</TableCell></TableRow> :
                     completedRepairs.map((r, i) => {
                       const d = getDeviceDetails(r.deviceId);
                       return (
                         <TableRow key={i}>
                           <TableCell style={{color:'var(--text-secondary)'}}>{r.rowId}</TableCell>
                           <TableCell><strong>{d ? d.name : r.deviceId}</strong><br/><small>{d?.department}</small></TableCell>
                           <TableCell>{r.description}</TableCell>
                           <TableCell><Badge variant="success">{r.status}</Badge></TableCell>
                         </TableRow>
                       );
                     })
                    }
                  </TableBody>
                </Table>
                
              </>
            )}

            {/* KIỂM ĐỊNH CHUNG */}
            {activeMainTab === 'bao-cao' && subTab === 'kiem-dinh' && (
              <>
                <h3 style={{ marginBottom: '16px', color: 'var(--primary-dark)', fontSize: '1.2rem', fontWeight: 600 }}>
                  Báo cáo Kiểm định & Đăng kiểm chung ({devices.length} TB)
                </h3>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Mã thiết bị</TableHeader>
                      <TableHeader>Tên thiết bị</TableHeader>
                      <TableHeader>Khoa/Phòng</TableHeader>
                      <TableHeader>Ngày Đăng kiểm</TableHeader>
                      <TableHeader>Bảo dưỡng tiếp theo</TableHeader>
                      <TableHeader>Trạng thái</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? <TableRow><TableCell colSpan={6} style={{textAlign:'center', padding: '2rem'}}>Đang tải...</TableCell></TableRow> : 
                     devices.map((d, i) => {
                       const dk = String(d['Ngày cấp/ Ngày Đăng kiểm'] || '');
                       const isMissing = !dk || dk.trim() === '' || dk.trim() === 'N/A';
                       return (
                         <TableRow key={i}>
                           <TableCell style={{color:'var(--text-secondary)'}}>{d.id}</TableCell>
                           <TableCell><strong>{d.name}</strong></TableCell>
                           <TableCell>{d.department}</TableCell>
                            <TableCell>{dk || 'N/A'}</TableCell>
                            <TableCell>{String(d['Ngày bảo dưỡng tiếp theo'] || 'N/A')}</TableCell>
                           <TableCell>
                             {isMissing ? <Badge variant="danger">Chưa kiểm định</Badge> : <Badge variant="success">Đã kiểm định</Badge>}
                           </TableCell>
                         </TableRow>
                       );
                     })
                    }
                  </TableBody>
                </Table>
              </>
            )}

          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default Reports;
