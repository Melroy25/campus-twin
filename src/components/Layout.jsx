import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children, pageTitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        <Header
          onMenuClick={() => setSidebarOpen((v) => !v)}
          pageTitle={pageTitle}
        />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
