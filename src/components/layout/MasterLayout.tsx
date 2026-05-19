import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import './MasterLayout.css';

const MasterLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="master-layout">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="content-wrapper">
        <TopNav toggleSidebar={toggleSidebar} />
        <main className="main-content">
          <Outlet /> {/* This will render nested routes */}
        </main>
      </div>
    </div>
  );
};

export default MasterLayout;
