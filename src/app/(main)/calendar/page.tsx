"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Filter, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { MediaThumbnail } from "@/components/MediaThumbnail";

interface Post {
  id: string;
  content: string;
  scheduledTime: string | null;
  status: string;
  mediaUrls: string | null;
  mediaThumbnails: string | null; // 缩略图 URL 数组
  externalPostUrl: string | null;
  account: { id: string; name: string; handle: string; platform: { id: string; name: string } };
}

interface Account {
  id: string;
  name: string;
  handle: string;
  platform: { id: string; name: string };
}

interface Platform {
  id: string;
  name: string;
}

export default function CalendarPage() {
  const { status } = useSession();
  const { addToast } = useUIStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const [postsRes, accountsRes] = await Promise.all([
        fetch(`/api/posts${statusParam}`),
        fetch("/api/accounts")
      ]);
      
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }
      
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(Array.isArray(accountsData) ? accountsData : accountsData.accounts || []);
        
        // 提取所有平台
        const allPlatforms = new Map<string, Platform>();
        accountsData.accounts?.forEach((account: Account) => {
          if (account.platform && !allPlatforms.has(account.platform.id)) {
            allPlatforms.set(account.platform.id, account.platform);
          }
        });
        setPlatforms(Array.from(allPlatforms.values()));
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (selectedAccounts.length > 0) {
        selectedAccounts.forEach(id => params.append("accountIds", id));
      }
      if (selectedPlatforms.length > 0) {
        selectedPlatforms.forEach(id => params.append("platformIds", id));
      }
      
      const queryString = params.toString();
      const url = queryString ? `/api/posts?${queryString}` : "/api/posts";
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error("获取帖子失败:", error);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPosts();
    }
  }, [selectedAccounts, selectedPlatforms, statusFilter, status]);

  const toggleAccountFilter = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const togglePlatformFilter = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const clearAllFilters = () => {
    setSelectedAccounts([]);
    setSelectedPlatforms([]);
  };

  const hasActiveFilters = selectedAccounts.length > 0 || selectedPlatforms.length > 0 || statusFilter !== "all";

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const getPostsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return posts.filter((post) => {
      if (!post.scheduledTime) return false;
      const postDate = new Date(post.scheduledTime);
      return (
        postDate.getDate() === day &&
        postDate.getMonth() === month &&
        postDate.getFullYear() === year
      );
    });
  };

  const getPostsForSelectedDate = () => {
    if (!selectedDate) return [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    return posts.filter((post) => {
      if (!post.scheduledTime) return false;
      const postDate = new Date(post.scheduledTime);
      return (
        postDate.getDate() === day &&
        postDate.getMonth() === month &&
        postDate.getFullYear() === year
      );
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];

  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    scheduled: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    published: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  };

  const statusLabels: Record<string, string> = {
    draft: "草稿",
    scheduled: "已计划",
    published: "已发布",
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const days = getDaysInMonth(currentDate);
  const selectedDatePosts = getPostsForSelectedDate();

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const statusFilters = [
    { value: "all", label: "全部" },
    { value: "draft", label: "草稿" },
    { value: "scheduled", label: "已计划" },
    { value: "published", label: "已发布" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">日历视图</h1>
          <Link href="/posts/new">
            <Button size="sm">
              <Plus size={16} className="mr-1" />
              新建
            </Button>
          </Link>
        </div>
        
        {/* 筛选按钮区域 - 右侧 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 账号筛选 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAccountFilter(!showAccountFilter);
                setShowPlatformFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                selectedAccounts.length > 0
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Filter size={16} />
              <span>账号</span>
              {selectedAccounts.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {selectedAccounts.length}
                </span>
              )}
            </button>
            
            {showAccountFilter && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="p-2 max-h-64 overflow-y-auto">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 p-2">暂无账号</p>
                  ) : (
                    accounts.map(account => (
                      <label
                        key={account.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(account.id)}
                          onChange={() => toggleAccountFilter(account.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {account.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          @{account.handle}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 平台筛选 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPlatformFilter(!showPlatformFilter);
                setShowAccountFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                selectedPlatforms.length > 0
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Filter size={16} />
              <span>平台</span>
              {selectedPlatforms.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {selectedPlatforms.length}
                </span>
              )}
            </button>
            
            {showPlatformFilter && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="p-2">
                  {platforms.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 p-2">暂无平台</p>
                  ) : (
                    platforms.map(platform => (
                      <label
                        key={platform.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(platform.id)}
                          onChange={() => togglePlatformFilter(platform.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {platform.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 清除筛选 */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setStatusFilter("all");
                clearAllFilters();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={12} />
              清除
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <ChevronLeft size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                今天
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1"
              >
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();
              const isSelected =
                selectedDate &&
                day === selectedDate.getDate() &&
                currentDate.getMonth() === selectedDate.getMonth() &&
                currentDate.getFullYear() === selectedDate.getFullYear();
              const dayPosts = day ? getPostsForDate(day) : [];

              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                  className={`min-h-[100px] p-0.5 border border-gray-100 dark:border-gray-700 rounded cursor-pointer transition-colors ${
                    day ? "hover:bg-gray-50 dark:hover:bg-gray-700/50" : "bg-gray-50 dark:bg-gray-900 cursor-default"
                  } ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""} ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-[10px] font-medium block mb-0.5 ${
                          isToday
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {day}
                      </span>
                      {dayPosts.length > 0 && (
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 4).map((post) => {
                            const mediaArr = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
                            const thumbnailsArr = post.mediaThumbnails ? JSON.parse(post.mediaThumbnails) : [];
                            return (
                              <div
                                key={post.id}
                                className={`text-[10px] p-0.5 rounded flex items-center gap-1 ${statusColors[post.status] || statusColors.draft}`}
                              >
                                {mediaArr.length > 0 && (
                                  <MediaThumbnail
                                    urls={mediaArr}
                                    thumbnails={thumbnailsArr}
                                    size={28}
                                    className="rounded flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-medium truncate">
                                    {new Date(post.scheduledTime!).toLocaleTimeString("zh-CN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                  {post.content && (
                                    <div className="text-[9px] opacity-60 truncate dark:opacity-40">
                                      {post.content}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {dayPosts.length > 4 && (
                            <div className="text-[9px] text-gray-400 dark:text-gray-500 text-center">
                              +{dayPosts.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedDate
                ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
                : "选择日期"}
            </h3>
            
            {selectedDate && (
              <Link href={`/posts/new?date=${formatSelectedDate()}`}>
                <Button size="sm">
                  <Plus size={16} className="mr-1" />
                  添加
                </Button>
              </Link>
            )}
          </div>
          
          {selectedDate && (
            <div className="space-y-3">
              {selectedDatePosts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">当天没有发布计划</p>
                  <Link href={`/posts/new?date=${formatSelectedDate()}`}>
                    <Button variant="ghost" size="sm">
                      <Plus size={16} className="mr-1" />
                      创建计划
                    </Button>
                  </Link>
                </div>
              ) : (
                selectedDatePosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}/edit`}
                    className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          @{post.account?.handle}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${statusColors[post.status] || statusColors.draft}`}>
                          {statusLabels[post.status] || "未知"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {post.externalPostUrl && (
                          <a
                            href={post.externalPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="查看已发布内容"
                          >
                            <ExternalLink size={14} className="text-blue-500" />
                          </a>
                        )}
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {new Date(post.scheduledTime!).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                        <MediaThumbnail
                          urls={JSON.parse(post.mediaUrls)}
                          size={40}
                          className="rounded"
                        />
                      )}
                      <p className="text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">
                        {post.content || "（无文字内容）"}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {!selectedDate && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">点击日历上的日期查看详情或添加计划</p>
          )}
        </div>
      </div>
    </div>
  );
}
