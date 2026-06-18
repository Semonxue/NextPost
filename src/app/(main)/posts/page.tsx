"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Edit2, Trash2, Calendar, X, ExternalLink, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { Pagination } from "@/components/ui/Pagination";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore, SortField, SortOrder } from "@/stores/filterStore";
import { getPlatformBadgeClasses, getPlatformStyle } from "@/lib/platform-style";

interface Post {
  id: string;
  content: string;
  scheduledTime: string | null;
  status: string;
  mediaUrls: string | null;
  mediaThumbnails: string | null;
  publishToken: string | null;
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

export default function PostsPage() {
  const { status } = useSession();
  const { addToast } = useUIStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 搜索关键词 - 不持久化，只在当前访问过程里传递
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // 使用 filterStore 管理筛选状态（自动同步到 cookie）
  const { 
    selectedAccounts, 
    selectedPlatforms, 
    statusFilter,
    sortField,
    sortOrder,
    setStatusFilter,
    toggleAccount, 
    togglePlatform, 
    toggleSort,
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
      // 搜索参数
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      // 排序参数
      params.set("sortField", sortField);
      params.set("sortOrder", sortOrder);
      
      // 添加分页参数
      params.set("limit", pageSize.toString());
      params.set("offset", ((currentPage - 1) * pageSize).toString());
      
      const queryString = params.toString();
      const postsUrl = `/api/posts?${queryString}`;
      
      const [postsRes, accountsRes, platformsRes] = await Promise.all([
        fetch(postsUrl),
        fetch("/api/accounts"),
        fetch("/api/platforms")
      ]);
      
      if (postsRes.ok) {
        const postsData = await postsRes.json() as { posts?: Post[]; total?: number };
        setPosts(postsData.posts || []);
        setTotalPosts(postsData.total || 0);
      }
      
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json() as { accounts?: Account[] };
        const accountsList: Account[] = Array.isArray(accountsData) ? accountsData : accountsData.accounts || [];
        setAccounts(accountsList);

        // 提取所有平台（兼容 accountsData 是数组的情况）
        const allPlatforms = new Map<string, Platform>();
        for (const account of accountsList) {
          if (account.platform && !allPlatforms.has(account.platform.id)) {
            allPlatforms.set(account.platform.id, account.platform);
          }
        }
        setPlatforms(Array.from(allPlatforms.values()));
      }

      // 平台列表（v0.5 新增：从 /api/platforms 拉全量，覆盖仅从账号派生的旧逻辑）
      if (platformsRes.ok) {
        const platformsData = await platformsRes.json() as { platforms?: Platform[] };
        const platformsList: Platform[] = platformsData.platforms || [];
        setPlatforms(platformsList);
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
      
      // 搜索参数
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      
      // 排序参数
      params.set("sortField", sortField);
      params.set("sortOrder", sortOrder);
      
      params.set("limit", pageSize.toString());
      params.set("offset", ((currentPage - 1) * pageSize).toString());
      
      const queryString = params.toString();
      const url = `/api/posts?${queryString}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { posts?: Post[]; total?: number };
        setPosts(data.posts || []);
        setTotalPosts(data.total || 0);
      }
    } catch (error) {
      console.error("获取帖子失败:", error);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPosts();
    }
  }, [status, statusFilter, selectedAccounts, selectedPlatforms, sortField, sortOrder, searchQuery, currentPage, pageSize]);

  // 回车搜索
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setSearchQuery(searchInput.trim());
      setCurrentPage(1);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个帖子吗？")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", message: "帖子已删除" });
        fetchPosts();
      }
    } catch {
      addToast({ type: "error", message: "删除失败" });
    }
  };

  // 渲染排序图标
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortOrder === "asc" 
      ? <ArrowUp size={14} className="inline ml-1 text-blue-600" />
      : <ArrowDown size={14} className="inline ml-1 text-blue-600" />;
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusFilters = [
    { value: "all", label: "全部" },
    { value: "draft", label: "草稿" },
    { value: "scheduled", label: "已计划" },
    { value: "published", label: "已发布" },
  ];

  const hasActiveFilters = selectedAccounts.length > 0 || selectedPlatforms.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">帖子列表</h1>
          <Link href="/posts/new">
            <Button size="sm">
              <Plus size={16} className="mr-1" />
              新建
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 搜索框 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索内容或账号名..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {accounts.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 p-2">暂无账号</p>
                    ) : (
                      accounts.map(account => (
                        <label
                          key={account.id}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAccounts.includes(account.id)}
                            onChange={() => toggleAccount(account.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 flex-shrink-0"
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">
                              {account.name}
                            </span>
                            <span className={`px-1 py-0.5 text-[10px] rounded flex-shrink-0 ${getPlatformStyle(account.platform.name).bgClass} ${getPlatformStyle(account.platform.name).textClass}`}>
                              {getPlatformStyle(account.platform.name).label}
                            </span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
                            onChange={() => togglePlatform(platform.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {getPlatformStyle(platform.name).label}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
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
            {(hasActiveFilters || statusFilter !== "all") && (
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
      </div>
      {/* 帖子列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无帖子</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">创建你的第一个帖子开始使用</p>
            <Link href="/posts/new">
              <Button>
                <Plus size={20} className="mr-2" />
                新建帖子
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">内容</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">账号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">平台</th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => toggleSort("scheduledTime")}
                  >
                    发布时间 {renderSortIcon("scheduledTime")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">状态</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                          <MediaThumbnail
                            urls={JSON.parse(post.mediaUrls)}
                            thumbnails={post.mediaThumbnails ? JSON.parse(post.mediaThumbnails) : undefined}
                            size={84}
                          />
                        )}
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {post.content || "（无文字内容）"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400">@{post.account?.handle || "未知"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {post.account?.platform ? (
                        <span className={getPlatformBadgeClasses(post.account.platform.name)}>
                          {getPlatformStyle(post.account.platform.name).label}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {post.scheduledTime
                          ? new Date(post.scheduledTime).toLocaleString("zh-CN")
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : post.status === "scheduled"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {post.status === "published" ? "已发布" : post.status === "scheduled" ? "已计划" : "草稿"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {post.externalPostUrl && (
                          <a
                            href={post.externalPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="查看已发布内容"
                          >
                            <ExternalLink size={14} className="text-blue-500" />
                          </a>
                        )}
                        <Link
                          href={`/posts/${post.id}/edit`}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <Edit2 size={14} className="text-gray-500" />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* 分页 */}
      {posts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalPosts}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
    </div>
  );
}
