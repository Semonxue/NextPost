"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";
import { Button } from "@/components/ui/Button";
import { MediaThumbnail } from "@/components/MediaThumbnail";

interface Post {
  id: string;
  content: string;
  scheduledTime: string | null;
  publishedAt: string | null;
  status: string;
  mediaUrls: string | null;
  mediaThumbnails: string | null;
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
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  
  // 使用 filterStore 管理筛选状态（自动同步到 cookie）
  const { 
    selectedAccounts, 
    selectedPlatforms, 
    statusFilter,
    setStatusFilter,
    toggleAccount, 
    togglePlatform, 
    clearAll,
    rehydrate
  } = useFilterStore();

  // 组件挂载时从 cookie 恢复筛选状态
  useEffect(() => {
    rehydrate();
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      // 构建查询参数，与 fetchPosts 保持一致
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
      const postsUrl = queryString ? `/api/posts?${queryString}` : "/api/posts";
      
      const [postsRes, accountsRes] = await Promise.all([
        fetch(postsUrl),
        fetch("/api/accounts")
      ]);
      
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }
      
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(Array.isArray(accountsData) ? accountsData : accountsData.accounts || []);
        
        // 提取所有平台（从 /api/platforms 拿全量，不依赖账号）
        // 注意：accountsData 可能是数组或 {accounts: []} 包装，accountsData.accounts?.forEach 永远空
        try {
          const platformsRes = await fetch('/api/platforms')
          if (platformsRes.ok) {
            const platformsData = await platformsRes.json()
            setPlatforms(platformsData.platforms || [])
          }
        } catch {
          // fallback：从账号派生（保底）
          const allPlatforms = new Map<string, Platform>();
          (Array.isArray(accountsData) ? accountsData : (accountsData.accounts || [])).forEach((account: Account) => {
            if (account.platform && !allPlatforms.has(account.platform.id)) {
              allPlatforms.set(account.platform.id, account.platform);
            }
          });
          setPlatforms(Array.from(allPlatforms.values()));
        }
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

  // 获取帖子应该显示的日期
  // - scheduled/draft 帖子使用 scheduledTime
  // - published 帖子使用 publishedAt（如果存在），否则降级到 scheduledTime
  const getDisplayTime = (post: Post): string | null => {
    if (post.status === 'published' && post.publishedAt) {
      return post.publishedAt;
    }
    return post.scheduledTime;
  };

  const getPostsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dayPosts = posts.filter((post) => {
      const displayTime = getDisplayTime(post);
      if (!displayTime) return false;
      const postDate = new Date(displayTime);
      return (
        postDate.getDate() === day &&
        postDate.getMonth() === month &&
        postDate.getFullYear() === year
      );
    });
    // 按发布时间从早到晚排序（升序）
    return dayPosts.sort((a, b) => {
      const timeA = new Date(getDisplayTime(a)!).getTime();
      const timeB = new Date(getDisplayTime(b)!).getTime();
      return timeA - timeB;
    });
  };

  const getPostsForSelectedDate = () => {
    if (!selectedDate) return [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dayPosts = posts.filter((post) => {
      const displayTime = getDisplayTime(post);
      if (!displayTime) return false;
      const postDate = new Date(displayTime);
      return (
        postDate.getDate() === day &&
        postDate.getMonth() === month &&
        postDate.getFullYear() === year
      );
    });
    // 按发布时间从早到晚排序（升序）
    return dayPosts.sort((a, b) => {
      const timeA = new Date(getDisplayTime(a)!).getTime();
      const timeB = new Date(getDisplayTime(b)!).getTime();
      return timeA - timeB;
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

  const hasActiveFilters = selectedAccounts.length > 0 || selectedPlatforms.length > 0 || statusFilter !== "all";

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
        <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          {/* 账号筛选 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAccountFilter(!showAccountFilter);
                setShowPlatformFilter(false);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedAccounts.length > 0
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span>账号</span>
              {selectedAccounts.length > 0 && (
                <span className="px-1 py-0.5 bg-white/20 text-white text-[10px] rounded-full">
                  {selectedAccounts.length}
                </span>
              )}
            </button>
            
            {showAccountFilter && (
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
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
                          onChange={() => toggleAccount(account.id)}
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
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedPlatforms.length > 0
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span>平台</span>
              {selectedPlatforms.length > 0 && (
                <span className="px-1 py-0.5 bg-white/20 text-white text-[10px] rounded-full">
                  {selectedPlatforms.length}
                </span>
              )}
            </button>
            
            {showPlatformFilter && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
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
                          onChange={() => togglePlatform(platform.id)}
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
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
          {/* 状态筛选 */}
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
          {/* 清除筛选 */}
          {hasActiveFilters && (
            <button
              onClick={() => clearAll()}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={12} />
              <span>清除</span>
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
                    <div className="space-y-0.5 max-h-[140px] overflow-y-auto scrollbar-thin">
                      {dayPosts.slice(0, 8).map((post) => {
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
                            size={30}
                            className="rounded flex-shrink-0"
                          />
                        )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-medium truncate">
                                {new Date(getDisplayTime(post)!).toLocaleTimeString("zh-CN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Shanghai",
                                })}
                              </div>
                              {post.content && (
                                <div className="text-[8px] opacity-60 truncate dark:opacity-40">
                                  {post.content}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {dayPosts.length > 8 && (
                        <div className="text-[8px] text-blue-600 dark:text-blue-400 text-center font-medium">
                          +{dayPosts.length - 8} 更多
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
              <Link href={`/posts/new?date=${formatSelectedDate()}&from=calendar`}>
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
                  <Link href={`/posts/new?date=${formatSelectedDate()}&from=calendar`}>
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
                    href={`/posts/${post.id}/edit?from=calendar`}
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
                      <div className="flex items-center gap-2">
                        {post.externalPostUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (post.externalPostUrl) {
                                window.open(post.externalPostUrl, '_blank', 'noopener,noreferrer')
                              }
                            }}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="查看已发布内容"
                          >
                            <ExternalLink size={14} className="text-blue-500" />
                          </button>
                        )}
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {new Date(getDisplayTime(post)!).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Shanghai",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                        <MediaThumbnail
                          urls={JSON.parse(post.mediaUrls)}
                          thumbnails={post.mediaThumbnails ? JSON.parse(post.mediaThumbnails) : undefined}
                          size={60}
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