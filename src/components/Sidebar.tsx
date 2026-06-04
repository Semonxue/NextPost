"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Calendar, FileText, Users, Wrench, Settings, Menu, X, LogOut, Trash2, ChevronDown } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useState, useEffect } from "react";

/**
 * 可折叠的导航项组件
 */
function NavItem({ item, onItemClick }: { item: typeof navItems[0]; onItemClick?: () => void }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  // 检查当前路径是否在子菜单中
  const hasActiveChild = item.children?.some((child) => pathname === child.href);

  // 如果是设置菜单且当前路径匹配，打开菜单
  useEffect(() => {
    if (item.children && hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild, item.children]);

  if (item.children) {
    // 可折叠的父级菜单
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
            hasActiveChild
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon size={20} />
            <span className="font-medium">{item.label}</span>
          </div>
          <ChevronDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onItemClick}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1 transition-colors text-sm ${
                    isChildActive
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <ChildIcon size={18} />
                  <span className="font-medium">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 普通导航项
  const isActive = pathname === item.href;
  return (
    <Link
      href={item.href!}
      onClick={onItemClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/calendar", label: "日历视图", icon: Calendar },
  { href: "/posts", label: "帖子列表", icon: FileText },
  { href: "/ai-tools", label: "AI tools", icon: Wrench },
  {
    label: "设置",
    icon: Settings,
    children: [
      { href: "/accounts", label: "账号管理", icon: Users },
      { href: "/settings", label: "常规设置", icon: Settings },
    ],
  },
  { href: "/trash", label: "回收站", icon: Trash2 },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">NextPost</h1>
        </div>

        <nav className="px-4 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              onItemClick={() => {
                if (window.innerWidth < 1024) toggleSidebar();
              }}
            />
          ))}
        </nav>

        {/* User profile section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {session ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {session.user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.user?.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {session.user?.email || "已登录"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <LogOut size={16} />
              <span>登录</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
