
'use client';
import Image from 'next/image';
import { LogOut, User, Users, HelpCircle, Book, Route } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';


export function Header() {
  const logo = PlaceHolderImages.find(img => img.id === 'company-logo');
  const { toast } = useToast();
  
  const startTour = async () => {
    const { driver } = await import("driver.js");

    const driverObj = driver({
      showProgress: true,
      steps: [
        { 
          element: '[data-tour="search"]', 
          popover: { 
            title: '全域搜尋', 
            description: '在這裡輸入案號、專案名稱或TPM窗口等關鍵字，可以快速找到您想查詢的任何專案。',
            side: "bottom", 
            align: 'start' 
          }
        },
        { 
          element: '[data-tour="filter-status"]', 
          popover: { 
            title: '篩選專案狀態', 
            description: '使用此選單可以快速篩選出不同狀態的專案，例如「進行中」、「已完成」或「逾期未報」。',
            side: "bottom", 
            align: 'start' 
          }
        },
        { 
          element: '[data-tour="add-new-project"]', 
          popover: { 
            title: '新增專案', 
            description: '點擊這裡可以一次性建立一個主專案及其下的多個子專案。',
            side: "bottom", 
            align: 'start' 
          }
        },
        {
          element: '[data-tour="on-hold-project"]',
          popover: {
            title: '專案暫緩',
            description: '若有專案或子專案需要暫停，可使用此功能進行標記。',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '[data-tour="resume-project"]',
          popover: {
            title: '恢復專案',
            description: '從這裡可以將先前被暫緩的專案或子專案恢復成「進行中」狀態。',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '[data-tour="export-all"]',
          popover: {
            title: '匯出總表',
            description: '一鍵將所有專案的最新進度匯出成 Excel 總表，方便線下報告與存檔。',
            side: "bottom",
            align: 'end'
          }
        },
        {
          element: '[data-tour="add-new-log"]',
          popover: {
            title: '新增週報',
            description: '點擊任一專案卡片上的這個按鈕，即可為該子專案快速新增一筆本週進度回報。',
            side: "top",
            align: 'center'
          }
        },
        {
          element: '[data-tour="help-menu"]',
          popover: {
            title: '需要協助嗎？',
            description: '您可以隨時從這裡重新啟動功能導覽，或下載完整的操作手冊。',
            side: "bottom",
            align: 'end'
          }
        }
      ]
    });
    
    driverObj.drive();
  }

  const handleDownload = async () => {
    try {
      const response = await fetch('/manual.pdf');
      if (!response.ok) {
        throw new Error('找不到檔案或網路錯誤');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = '操作手冊.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('下載失敗:', error);
      toast({
        title: "下載失敗",
        description: "無法取得操作手冊，請稍後再試或聯繫管理員。",
        variant: "destructive",
      });
    }
  };


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          {logo && (
            <Image
              src={logo.imageUrl}
              alt={logo.description}
              width={240}
              height={40}
              data-ai-hint={logo.imageHint}
              className="hidden sm:block object-contain"
            />
          )}
        </div>

        <div className="flex-1 flex justify-center px-4">
            <Link href="/dashboard" className="font-headline text-2xl md:text-3xl lg:text-4xl font-bold text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                燁輝智慧製造執行方案進度管制表
            </Link>
        </div>

        <div className="flex items-center justify-end space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1" data-tour="help-menu">
                  <HelpCircle className="h-4 w-4" />
                  幫助
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startTour}>
                  <Route className="mr-2 h-4 w-4" />
                  <span>功能導覽</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Book className="mr-2 h-4 w-4" />
                  <span>下載操作手冊</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="https://i.ibb.co/wNFFnrjp/logo1.png" alt="User Avatar" />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Charlie (Admin)</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      charlie@example.com
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>個人資料</span>
                  </DropdownMenuItem>
                  <Link href="/users" passHref>
                    <DropdownMenuItem>
                      <Users className="mr-2 h-4 w-4" />
                      <span>成員管理</span>
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
