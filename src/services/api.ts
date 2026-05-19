import { getAuthPayload } from '../authSession';

const DEFAULT_GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbznJoCVhOyzoGQmqIMXxB3stCBQYCd_OQ76k6hR75VDYsCs0V9dhtzrFmJMZO11di0K_w/exec';

export const GOOGLE_SHEETS_API_URL = import.meta.env.VITE_THIET_BI_API_URL || DEFAULT_GOOGLE_SHEETS_API_URL;

type ApiRow = Record<string, unknown>;

const asText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const getText = (row: ApiRow, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = asText(row[key]).trim();
    if (value) return value;
  }
  return fallback;
};
export interface DeviceDocument {
  docType: string;
  licenseNo: string;
  frequency: string;
  issuedDate: string;
  expiryDate: string;
  prepTime: string;
  status: string;
  daysUntilExpiry: number | null;
}

export interface DeviceData {
  id: string;
  name: string;
  department: string;
  status: string;
  dateAdded: string;
  documents?: DeviceDocument[];
  alertLevel?: 'ok' | 'warning' | 'danger';
  minDaysUntil?: number;
  [key: string]: unknown;
}

export interface UserData {
  username: string;
  role: string;
  name: string;
  email?: string;
  department?: string;
  token?: string;
  expiresAt?: number;
}

export interface RepairData {
  rowId: string;
  deviceId: string;
  userName: string;
  userEmail: string;
  description: string;
  status: string;
}

export interface TransferData {
  transferId: string;
  createdAt: string;
  deviceId: string;
  deviceName: string;
  fromDepartment: string;
  toDepartment: string;
  quantity: string;
  status: 'PENDING_RECEIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | string;
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  requestedNote: string;
  requestedAt: string;
  receivedBy: string;
  receivedByName: string;
  receivedByEmail: string;
  receivedNote: string;
  receivedAt: string;
  rejectedBy: string;
  rejectedAt: string;
  rejectReason: string;
  updatedAt: string;
}

// Hàm helper xử lý lỗi fetch chung
const safeFetch = async (input: RequestInfo, init?: RequestInit) => {
  try {
    const response = await fetch(input, init);
    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP Error ${response.status}:`, text);
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && data.success === false) {
        console.warn('API returned success=false:', data);
      }
      return data;
    } catch {
      console.error('Failed to parse JSON response. Response text was:', text);
      return null;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
};

const postAction = async (action: string, payload: Record<string, unknown> = {}) => {
  const data = await safeFetch(GOOGLE_SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      payload: {
        ...payload,
        ...getAuthPayload(),
      },
    }),
  });
  return data || { success: false, message: 'Lỗi kết nối mạng.' };
};

const postReadAction = async (action: string) => safeFetch(GOOGLE_SHEETS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action, payload: getAuthPayload() }),
});

export const fetchDevices = async (): Promise<DeviceData[]> => {
  const data = await safeFetch(`${GOOGLE_SHEETS_API_URL}?action=getDevices`);
  if (!data || !Array.isArray(data)) return [];

  const rows = data as ApiRow[];
  const validData = rows.filter(item => getText(item, ['Tên Thiết bị', 'name']) !== '');

  return validData.map((item, index: number) => {
    const isOldFormat = 'Tên Thiết bị' in item;
    const documents = Array.isArray(item.documents) ? item.documents as DeviceDocument[] : [];
    return {
      ...item,
      id: isOldFormat ? getText(item, ['Seri Máy'], `TB-${String(index + 1).padStart(3, '0')}`) : getText(item, ['serial'], `TB-${String(index + 1).padStart(3, '0')}`),
      name: isOldFormat ? getText(item, ['Tên Thiết bị']) : getText(item, ['name']),
      department: isOldFormat ? getText(item, ['Nơi đặt thiết bị'], 'Chưa phân bổ') : getText(item, ['location'], 'Chưa phân bổ'),
      status: 'O',
      dateAdded: isOldFormat ? getText(item, ['Ngày cấp/ Ngày Đăng kiểm'], 'N/A') : (documents[0]?.issuedDate || 'N/A'),
    };
  });
};

export const fetchUsers = async (): Promise<UserData[]> => {
  const data = await postReadAction('getUsers');
  if (!data || !Array.isArray(data)) return [];

  const rows = data as ApiRow[];
  const validData = rows.filter(item => getText(item, ['Tên đăng nhập', 'Username', 'username']) !== '');

  return validData.map(item => ({
    username: getText(item, ['Tên đăng nhập', 'Username', 'username']),
    role: getText(item, ['Quyền hạn', 'Quyền', 'Role'], 'User'),
    name: getText(item, ['Họ và Tên', 'Họ và tên', 'Name'], 'Người dùng'),
    email: getText(item, ['Email', 'email']),
    department: getText(item, ['Khoa/Phòng', 'Khoa/Phong']),
  }));
};

export const loginUser = async (payload: { username: string; pin: string }) => {
  const data = await safeFetch(GOOGLE_SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', payload }),
  });
  
  if (!data?.success) return data || { success: false, message: 'Lỗi kết nối mạng.' };
  const item = (data.user || {}) as ApiRow;
  return {
    success: true,
    user: {
      username: getText(item, ['Tên đăng nhập', 'Username', 'username']),
      role: getText(item, ['Quyền hạn', 'Quyền', 'Role'], 'User'),
      name: getText(item, ['Họ và Tên', 'Họ và tên', 'Name'], 'Người dùng'),
      email: getText(item, ['Email', 'email']),
      department: getText(item, ['Khoa/Phòng', 'Khoa/Phong', 'Khoa/ Phòng', 'Khoa', 'Department', 'department', 'Nơi công tác', 'Noi cong tac']),
      token: asText(data.token || item.token || item.sessionToken),
      expiresAt: Number(data.expiresAt || item.expiresAt || 0) || undefined,
    } as UserData,
  };
};

export const fetchRepairs = async (): Promise<RepairData[]> => {
  const data = await postReadAction('getRepairs');
  if (!data || !Array.isArray(data)) return [];

  return (data as ApiRow[]).map(item => ({
    rowId: getText(item, ['Thời gian']),
    deviceId: getText(item, ['Mã Máy/Thiết bị']),
    userName: getText(item, ['Người báo lỗi']),
    userEmail: getText(item, ['Email người báo']),
    description: getText(item, ['Mô tả lỗi']),
    status: getText(item, ['Trạng Thái'], 'Chờ duyệt'),
  }));
};

export const reportRepair = async (payload: Record<string, unknown>) => {
  return postAction('reportRepair', payload);
};

export const approveRepair = async (payload: { rowId: string; deviceId: string; newStatus: string; approver?: string; note?: string }) => {
  return postAction('approveRepair', payload);
};

export const addDevice = async (payload: {
  name: string;
  serial: string;
  department: string;
  dateAdded: string;
  notes?: string;
}) => {
  return postAction('addDevice', payload);
};

export const editDevice = async (payload: {
  serial: string;
  name: string;
  department: string;
  dateAdded: string;
  notes?: string;
}) => {
  return postAction('editDevice', payload);
};

export const updateDocumentStatus = async (serial: string, status: string) => {
  return postAction('updateDocStatus', { serial, status });
};

const mapTransfer = (item: ApiRow): TransferData => ({
  transferId: getText(item, ['TransferId', 'Thời gian']),
  createdAt: getText(item, ['CreatedAt', 'Thời gian']),
  deviceId: getText(item, ['DeviceId', 'Mã Máy/Thiết bị']),
  deviceName: getText(item, ['DeviceName', 'Tên Thiết bị']),
  fromDepartment: getText(item, ['FromDepartment', 'Từ khoa/phòng']),
  toDepartment: getText(item, ['ToDepartment', 'Đến khoa/phòng']),
  quantity: getText(item, ['Quantity', 'Số lượng']),
  status: getText(item, ['Status', 'Trạng thái']),
  requestedBy: getText(item, ['RequestedBy']),
  requestedByName: getText(item, ['RequestedByName', 'Người thực hiện']),
  requestedByEmail: getText(item, ['RequestedByEmail']),
  requestedNote: getText(item, ['RequestedNote', 'Lý do', 'Ghi chú']),
  requestedAt: getText(item, ['RequestedAt']),
  receivedBy: getText(item, ['ReceivedBy']),
  receivedByName: getText(item, ['ReceivedByName', 'Người nhận']),
  receivedByEmail: getText(item, ['ReceivedByEmail']),
  receivedNote: getText(item, ['ReceivedNote']),
  receivedAt: getText(item, ['ReceivedAt']),
  rejectedBy: getText(item, ['RejectedBy']),
  rejectedAt: getText(item, ['RejectedAt']),
  rejectReason: getText(item, ['RejectReason']),
  updatedAt: getText(item, ['UpdatedAt']),
});

export const fetchTransfers = async (): Promise<TransferData[]> => {
  const data = await postReadAction('getTransfers');
  if (!Array.isArray(data)) return [];
  return (data as ApiRow[]).map(mapTransfer);
};

export const createTransfer = async (payload: {
  deviceId: string;
  toDepartment: string;
  quantity?: string;
  reason?: string;
  actorUsername: string;
}) => {
  return postAction('createTransfer', payload);
};

export const receiveTransfer = async (payload: { transferId: string; actorUsername: string; note?: string }) => {
  return postAction('receiveTransfer', payload);
};

export const rejectTransfer = async (payload: { transferId: string; actorUsername: string; reason?: string }) => {
  return postAction('rejectTransfer', payload);
};

export const cancelTransfer = async (payload: { transferId: string; actorUsername: string; reason?: string }) => {
  return postAction('cancelTransfer', payload);
};

// ===== GSP (Nhiệt độ/Độ ẩm Kho) =====

export interface GspRecord {
  date: string;
  shift: string;
  tempKho: number;
  tempTuLanh: number;
  humidity: number;
  note: string;
  recorder: string;
}

export const fetchGspRecords = async (): Promise<GspRecord[]> => {
  const data = await postReadAction('getGSP');
  if (!Array.isArray(data)) return [];
  return (data as ApiRow[]).map(item => ({
    date: getText(item, ['Ngày', 'date']),
    shift: getText(item, ['Ca', 'shift']),
    tempKho: parseFloat(getText(item, ['Nhiệt độ Kho', 'tempKho'], '0')),
    tempTuLanh: parseFloat(getText(item, ['Nhiệt độ Tủ lạnh', 'tempTuLanh'], '0')),
    humidity: parseFloat(getText(item, ['Độ ẩm', 'humidity'], '0')),
    note: getText(item, ['Ghi chú', 'note']),
    recorder: getText(item, ['Người ghi', 'recorder']),
  }));
};

export const addGspRecord = async (payload: Omit<GspRecord, 'date'>) => {
  return postAction('addGSP', payload);
};
