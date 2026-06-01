"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Edit2, Trash2, Calendar, Filter, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/uiStore";

interface Post {
  id: string;
  content: string;
  scheduledTime: string | null;
  status: string;
  mediaUrls: string | null;
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);

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
      const [postsRes, accountsRes] = await Promise.all([
        fetch("/api/posts"),
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
  }, [statusFilter, selectedAccounts, selectedPlatforms, status]);

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

  const hasFilters = selectedAccounts.length > 0 || selectedPlatforms.length > 0;

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
        
        {/* 筛选区域 - 右侧 */}
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

          {/* 清除筛选 */}
          {hasFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              <X size={16} />
              清除
            </button>
          )}
        </div>
      </div>

      {/* 状态筛选 - 独立一行 */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 w-fit">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">内容</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">账号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">发布时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                          <div className="flex-shrink-0">
                            <img 
                              src={JSON.parse(post.mediaUrls)[0]} 
                              alt="媒体预览" 
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-2 max-w-md">
                          {post.content || "（无文字内容）"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-600 dark:text-gray-400">@{post.account?.handle || "未知"}</span>
                        {post.account?.platform && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {post.account.platform.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {post.scheduledTime
                          ? new Date(post.scheduledTime).toLocaleString("zh-CN")
                          : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : post.status === "scheduled"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {post.status === "published" ? "已发布" : post.status === "scheduled" ? "已计划" : "草稿"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {post.publishToken ? (
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                          {post.publishToken.slice(0, 12)}...
                        </code>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {post.externalPostUrl && (
                          <a
                            href={post.externalPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="查看已发布内容"
                          >
                            <ExternalLink size={16} className="text-blue-500" />
                          </a>
                        )}
                        <Link
                          href={`/posts/${post.id}/edit`}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} className="text-gray-500" />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-red-500" />
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
    </div>
  );
}
