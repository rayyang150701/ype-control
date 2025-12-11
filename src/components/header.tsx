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


export function Header() {
  const logo = PlaceHolderImages.find(img => img.id === 'company-logo');
  
  const startTour = async () => {
    const { driver } = await import("driver.js");

    const driverObj = driver({
      showProgress: true,
      steps: [
        { 
          element: '[data-tour="add-new-project"]', 
          popover: { 
            title: '新增專案', 
            description: '點擊這裡可以一次性建立一個主專案及其下的多個子專案。',
            side: "left", 
            align: 'start' 
          }
        },
        { 
          element: '[data-tour="filter-status"]', 
          popover: { 
            title: '篩選專案狀態', 
            description: '使用此選單可以快速篩選出不同狀態的專案，例如「進行中」、「已完成」或「逾期未報」。',
            side: "left", 
            align: 'start' 
          }
        },
      ]
    });
    
    driverObj.drive();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
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

        <div className="flex-1 flex justify-center">
            <Link href="/dashboard" className="font-headline text-2xl md:text-3xl lg:text-4xl font-bold text-primary whitespace-nowrap">
                燁輝智慧製造執行方案進度管制表
            </Link>
        </div>

        <div className="flex items-center justify-end space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <HelpCircle className="h-4 w-4" />
                  幫助
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startTour}>
                  <Route className="mr-2 h-4 w-4" />
                  <span>功能導覽</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/manual.pdf" download rel="noopener noreferrer">
                    <Book className="mr-2 h-4 w-4" />
                    <span>下載操作手冊</span>
                  </a>
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
