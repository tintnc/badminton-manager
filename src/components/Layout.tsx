import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Wallet, Settings, Menu, Swords } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

const months = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { initialize, globalMonth, globalYear, setGlobalDate } = useAppStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Buổi đánh', path: '/sessions', icon: CalendarDays },
    { name: 'Xếp cặp', path: '/pairing', icon: Swords },
    { name: 'Thành viên', path: '/members', icon: Users },
    { name: 'Tài chính', path: '/finance', icon: Wallet },
    { name: 'Cài đặt', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-card border-r transition duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-center h-16 border-b">
          <span className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-primary-foreground p-1 rounded-md">🏸</span>
            BaddyClub
          </span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-16 px-4 border-b bg-card">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Mở menu điều hướng"
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden mr-4 rounded-md"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <span className="text-lg font-bold lg:hidden">BaddyClub</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">Dữ liệu tháng:</span>
            <select
              aria-label="Chọn tháng dữ liệu"
              className="flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={globalMonth}
              onChange={(e) => setGlobalDate(Number(e.target.value), globalYear)}
            >
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              aria-label="Chọn năm dữ liệu"
              className="flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={globalYear}
              onChange={(e) => setGlobalDate(globalMonth, Number(e.target.value))}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
