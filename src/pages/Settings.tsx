import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { saveAs } from 'file-saver';
import { Download, Upload, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { toast } from '../components/ui/toast';
import { CostCalculator } from '../core/services/CostCalculator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { formatVnd } from '../lib/format';
import { PageHeader } from '../components/ui/page-header';
import { APP_VERSION } from '../core/config/defaults';

import { CurrencyInput, IntegerInput } from '../components/ui/currency-input';

const months = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export default function Settings() {
  const store = useAppStore();
  const { settings, updateSettings, members, sessions, transactions, shuttlecockBatches } = store;
  const { globalMonth, globalYear } = store;

  const [fund, setFund] = useState(settings.monthlySupportFund);
  const [location, setLocation] = useState(settings.defaultLocation);
  const [tubePrice, setTubePrice] = useState(settings.shuttlecockTubePrice ?? 300000);
  const [perTube, setPerTube] = useState(settings.shuttlecocksPerTube ?? 12);
  const [guestFee, setGuestFee] = useState(settings.guestFee ?? 35000);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  const pricePerBird = CostCalculator.pricePerShuttlecock(tubePrice, perTube);

  const handleSaveSettings = async () => {
    await updateSettings({
      monthlySupportFund: fund,
      defaultLocation: location,
      shuttlecockTubePrice: tubePrice,
      shuttlecocksPerTube: perTube,
      guestFee,
    });
    toast('Đã lưu cài đặt.');
  };

  const handleGenerateDemo = async () => {
    setIsGeneratingDemo(true);
    try {
      await store.generateDemoData(globalMonth, globalYear);
      setIsDemoOpen(false);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleExport = () => {
    const data = {
      version: APP_VERSION,
      exportDate: new Date().toISOString(),
      members,
      sessions,
      transactions,
      shuttlecockBatches,
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `baddyclub-backup-${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.members) && Array.isArray(data.sessions)) {
          const restored = {
            version: data.version ?? '1.0.0',
            lastUpdated: new Date().toISOString(),
            members: data.members,
            sessions: data.sessions,
            transactions: Array.isArray(data.transactions) ? data.transactions : [],
            shuttlecockBatches: Array.isArray(data.shuttlecockBatches) ? data.shuttlecockBatches : [],
            settings: data.settings && typeof data.settings === 'object' ? data.settings : settings,
          };
          const response = await fetch('/api/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restored),
          });
          if (!response.ok) {
            toast('Không ghi được vào data/badminton-data.json. Hãy chạy app bằng npm run dev.', 'error');
            return;
          }
          toast('Khôi phục thành công. Trang sẽ tải lại để áp dụng dữ liệu.');
          window.setTimeout(() => window.location.reload(), 600);
        } else {
          toast('Tệp sao lưu thiếu dữ liệu thành viên hoặc buổi đánh.', 'error');
        }
      } catch {
        toast('Tệp sao lưu không hợp lệ.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Cập nhật giá mặc định và quản lý sao lưu dữ liệu cho toàn bộ nhóm."
      />

      <div className="grid gap-6 md:grid-cols-2">

        {/* Club Config */}
        <Card>
          <CardHeader>
            <CardTitle>Cấu hình chung</CardTitle>
            <CardDescription>Cập nhật các giá trị mặc định cho nhóm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fund">Quỹ hỗ trợ mỗi tháng (₫)</Label>
                  <CurrencyInput
                    id="fund"
                    value={fund}
                    onChange={setFund}
                    placeholder="VD: 3,000,000…"
                  />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Địa điểm sân mặc định</Label>
                  <Input
                    id="location"
                    name="default-location"
                    autoComplete="off"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestFee">Phí khách vãng lai mỗi buổi (₫)</Label>
                  <CurrencyInput
                    id="guestFee"
                    value={guestFee}
                    onChange={setGuestFee}
                    placeholder="VD: 35,000…"
                  />
              <p className="text-[11px] text-muted-foreground">
                Khách vãng lai đóng cố định số tiền này cho mỗi buổi tham gia.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveSettings}>Lưu cài đặt</Button>
          </CardFooter>
        </Card>

        {/* Shuttlecock Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Giá cầu mặc định
            </CardTitle>
            <CardDescription>
              Giá gợi ý khi nhập lô cầu mới. Tiền cầu mỗi buổi sẽ lấy theo tồn kho FIFO trong trang Kho cầu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tubePrice">Giá gợi ý mỗi ống cầu (₫)</Label>
                  <CurrencyInput
                    id="tubePrice"
                    value={tubePrice}
                    onChange={setTubePrice}
                    placeholder="VD: 300,000…"
                  />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perTube">Số trái cầu mỗi ống</Label>
                  <IntegerInput
                    id="perTube"
                    value={perTube}
                    onChange={setPerTube}
                    placeholder="VD: 12…"
                  />
            </div>

            {/* Live preview */}
            <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giá gợi ý mỗi trái:</span>
                <span className="font-semibold text-primary">
                    {formatVnd(pricePerBird)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">3 trái/buổi:</span>
                <span className="font-semibold">
                    {formatVnd(CostCalculator.shuttlecockFee(3, tubePrice, perTube))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">5 trái/buổi:</span>
                <span className="font-semibold">
                    {formatVnd(CostCalculator.shuttlecockFee(5, tubePrice, perTube))}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveSettings}>Lưu cài đặt</Button>
          </CardFooter>
        </Card>

        {/* Data Management */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quản lý dữ liệu</CardTitle>
            <CardDescription>
              Dữ liệu chính được lưu tại <span className="font-mono">data/badminton-data.json</span>. Nút xuất file vẫn dùng để tạo bản sao lưu tải về.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExport} className="flex-1" variant="outline">
                <Download className="mr-2 h-4 w-4" /> Xuất bản sao lưu (JSON)
              </Button>
              <Label htmlFor="import-file" className="flex-1">
                <div className="flex items-center justify-center h-10 px-4 py-2 border rounded-md border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm font-medium transition-colors">
                  <Upload className="mr-2 h-4 w-4" /> Khôi phục bản sao lưu
                </div>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </Label>
            </div>

            <div className="rounded-md bg-muted/50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Dữ liệu demo</p>
                <p className="text-xs text-muted-foreground">
                  Thay dữ liệu hiện tại bằng bộ dữ liệu demo của tháng {months[globalMonth]} {globalYear}.
                </p>
              </div>
              <Button variant="outline" className="shrink-0" onClick={() => setIsDemoOpen(true)}>
                <ShoppingCart className="h-4 w-4" /> Tạo dữ liệu demo
              </Button>
            </div>

            <div className="rounded-md border border-destructive p-4">
              <div className="flex items-center gap-2 text-destructive mb-2 font-semibold">
                <AlertTriangle className="h-5 w-5" /> Khu vực nguy hiểm
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Xóa vĩnh viễn toàn bộ dữ liệu. Hành động này không thể hoàn tác. Hãy chắc chắn rằng bạn đã tải bản sao lưu về máy.
              </p>
                <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                  Xóa toàn bộ dữ liệu
                </Button>
            </div>
          </CardContent>
        </Card>

        </div>
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa toàn bộ dữ liệu?</DialogTitle>
              <DialogDescription>
                Toàn bộ thành viên, buổi đánh, giao dịch và cài đặt sẽ bị xóa vĩnh viễn. Hãy xuất bản sao lưu trước khi tiếp tục.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
              onClick={async () => {
                await fetch('/api/data', { method: 'DELETE' });
                localStorage.removeItem('badminton_members');
                localStorage.removeItem('badminton_sessions');
                localStorage.removeItem('badminton_transactions');
                localStorage.removeItem('badminton_settings');
                window.location.reload();
              }}
              >
                Xóa dữ liệu
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo dữ liệu demo?</DialogTitle>
              <DialogDescription>
                Dữ liệu hiện tại (thành viên, buổi đánh, giao dịch) sẽ bị thay thế bằng bộ dữ liệu demo
                của tháng {months[globalMonth]} {globalYear}. Hãy xuất bản sao lưu trước nếu cần.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDemoOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleGenerateDemo} disabled={isGeneratingDemo}>
                {isGeneratingDemo ? 'Đang tạo…' : 'Tạo dữ liệu demo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
