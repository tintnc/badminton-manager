import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Wallet, Settings, Menu, Swords, ChevronLeft, ChevronRight, Package, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/button';

const months = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

type Theme = 'light' | 'dark';
const themeStorageKey = 'badminton_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(themeStorageKey);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { initialize, globalMonth, globalYear, setGlobalDate } = useAppStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#020817' : '#ffffff');
  }, [theme]);

  useEffect(() => {
    if (!monthPickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!monthPickerRef.current?.contains(event.target as Node)) {
        setMonthPickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [monthPickerOpen]);

  const shiftMonth = (offset: number) => {
    const next = new Date(globalYear, globalMonth + offset, 1);
    setGlobalDate(next.getMonth(), next.getFullYear());
    setPickerYear(next.getFullYear());
  };

  const toggleTheme = () => {
    setTheme(current => current === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Buổi đánh', path: '/sessions', icon: CalendarDays },
    { name: 'Kho cầu', path: '/shuttlecocks', icon: Package },
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
        className={`fixed inset-y-0 left-0 z-30 w-64 max-h-screen transform bg-card border-r transition duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-center h-16 border-b px-4">
          <span className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-primary-foreground p-1 rounded-md">🏸</span>
            BaddyClub
          </span>
        </div>

        <nav role="navigation" aria-label="Primary navigation" className="p-4 space-y-1 overflow-y-auto">
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
        <header className="flex h-16 items-center justify-between gap-3 border-b bg-card px-3 sm:px-4">
          <div className="flex min-w-0 shrink-0 items-center">
            <button
              type="button"
              aria-label="Mở menu điều hướng"
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden mr-4 rounded-md"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-foreground lg:hidden">BaddyClub</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>

            <div ref={monthPickerRef} className="relative flex items-center gap-1">
              <button
                type="button"
                aria-label="Xem tháng trước"
                onClick={() => shiftMonth(-1)}
                className="hidden sm:inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="Chọn tháng dữ liệu"
                aria-expanded={monthPickerOpen}
                onClick={() => {
                  setPickerYear(globalYear);
                  setMonthPickerOpen((open) => !open);
                }}
                className="inline-flex h-10 min-w-[148px] items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-w-[176px]"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Dữ liệu</span>
                    <span className="font-semibold">{months[globalMonth]}, {globalYear}</span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                aria-label="Xem tháng sau"
                onClick={() => shiftMonth(1)}
                className="hidden sm:inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>

            {monthPickerOpen && (
              <div className="absolute right-0 top-12 z-40 w-[320px] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Năm trước"
                    onClick={() => setPickerYear((year) => year - 1)}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="text-sm font-bold">{pickerYear}</div>
                  <button
                    type="button"
                    aria-label="Năm sau"
                    onClick={() => setPickerYear((year) => year + 1)}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {months.map((month, index) => {
                    const isSelected = index === globalMonth && pickerYear === globalYear;
                    return (
                      <button
                        key={month}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setGlobalDate(index, pickerYear);
                          setMonthPickerOpen(false);
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-transparent bg-muted/40 hover:border-input hover:bg-muted'
                        }`}
                      >
                        {month.replace('Tháng ', 'T')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
