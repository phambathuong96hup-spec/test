import React, { useState } from 'react';
import { Menu, Search, Bell, ChevronDown, LogOut, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../authContext';
import './TopNav.css';

interface TopNavProps {
  toggleSidebar: () => void;
}

const TopNav: React.FC<TopNavProps> = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const { isAuthenticated, name, role, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate('/dashboard');
  };

  return (
    <header className="topnav">
      <div className="topnav-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
      </div>

      <div className="topnav-center">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên thiết bị, số Serial..."
            className="search-input"
          />
        </div>
      </div>

      <div className="topnav-right">
        <button className="nav-action-btn">
          <Bell size={20} />
          <span className="notification-badge"></span>
        </button>

        {isAuthenticated ? (
          /* ===== ĐÃ ĐĂNG NHẬP: Hiện avatar + tên ===== */
        <div
            className="user-profile"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ position: 'relative' }}
          >
            <div className="avatar">{initial}</div>
            <div className="user-info">
              <span className="user-name">{name}</span>
              <span className="user-role">
                {role?.toLowerCase() === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
            <ChevronDown size={16} color="var(--text-secondary)" />

            {showDropdown && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="dropdown-name">{name}</div>
                  <div className="dropdown-role">{role}</div>
                </div>
                <button onClick={handleLogout} className="user-dropdown-btn">
                  <LogOut size={16} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ===== CHƯA ĐĂNG NHẬP: Nút Đăng nhập ===== */
          <button
            className="btn-login-topnav"
            onClick={() => navigate('/login')}
          >
            <LogIn size={16} />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopNav;
