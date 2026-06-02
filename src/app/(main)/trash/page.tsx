"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Trash2, RotateCcw, AlertTriangle, FileText, User, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useUIStore } from "@/stores/uiStore";
type TabKey = "posts" | "accounts";
interface TrashPost {
  id: string;
  content: string;
  accountId: string;
  account: { id: string; name: string; handle: string; platform?: { name: string } };
  status: string;
  scheduledTime: string | null;
  deletedAt: string;
  deletedBy: string | null;
  deleteNote: string | null;
  createdAt: string;
}
interface TrashAccount {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  platform?: { name: string };
  deletedAt: string;
  deletedBy: string | null;
  deleteNote: string | null;
  createdAt: string;
}
export default function TrashPage() {
  const { status } = useSession();
  const { addToast } = useUIStore();
  const [tab, setTab] = useState<TabKey>("posts");
  const [posts, setPosts] = useState<TrashPost[]>([]);
  const [accounts, setAccounts] = useState<TrashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("postsLimit", pageSize.toString());
      params.set("postsOffset", ((currentPage - 1) * pageSize).toString());
      params.set("accountsLimit", pageSize.toString());
      params.set("accountsOffset", ((currentPage - 1) * pageSize).toString());
      const res = await fetch(`/api/trash?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setAccounts(data.accounts || []);
        setTotalPosts(data.totalPosts || 0);
        setTotalAccounts(data.totalAccounts || 0);
      } else {
        addToast({ type: "error", message: "获取回收站失败" });
      }
    } catch {
      addToast({ type: "error", message: "网络错误" });
    } finally {
      setLoading(false);
    }
  }, [addToast, currentPage, pageSize]);
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchTrash();
    }
  }, [status, fetchTrash]);
  const handleRestore = async (id: string, type: TabKey) => {
    setActing(id);
    try {
      const url =
        type === "posts"
          ? `/api/trash/posts/${id}/restore`
          : `/api/trash/accounts/${id}/restore`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        addToast({ type: "success", message: "已恢复" });
        fetchTrash();
      } else {
        const data = await res.json();
        addToast({ type: "error", message: data.error || "恢复失败" });
      }
    } catch {
      addToast({ type: "error", message: "网络错误" });
    } finally {
      setActing(null);
    }
  };
  const handlePermanentDelete = async (id: string, type: TabKey) => {
    if (!confirm("确定要永久删除吗？此操作无法撤销。")) return;
    setActing(id);
    try {
      const url =
        type === "posts"
          ? `/api/trash/posts/${id}`
          : `/api/trash/accounts/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", message: "已永久删除" });
        fetchTrash();
      } else {
        const data = await res.json();
        addToast({ type: "error", message: data.error || "删除失败" });
      }
    } catch {
      addToast({ type: "error", message: "网络错误" });
    } finally {
      setActing(null);
    }
  };
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">回收站</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          已删除的帖子和账号可以在此恢复或永久删除
        </p>
      </div>
      {/* Tab 切换 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => { setTab("posts"); setCurrentPage(1); }}
            data-testid="tab-posts"
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "posts"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <FileText size={16} className="inline mr-1" />
            帖子 ({totalPosts})
          </button>
          <button
            onClick={() => { setTab("accounts"); setCurrentPage(1); }}
            data-testid="tab-accounts"
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "accounts"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <User size={16} className="inline mr-1" />
            账号 ({totalAccounts})
          </button>
        </nav>
      </div>
      {/* 列表 */}
      {tab === "posts" ? (
        posts.length === 0 ? (
          <EmptyState message="回收站是空的" hint="删除的帖子会出现在这里" />
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                data-testid="trash-post-item"
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs">
                        {post.status}
                      </span>
                      <span>
                        @{post.account.handle} · {post.account.platform?.name || "Twitter"}
                      </span>
                      <span>
                        删除于 {new Date(post.deletedAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white line-clamp-2">
                      {post.content || "(无文本内容)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRestore(post.id, "posts")}
                      loading={acting === post.id}
                      data-testid="restore-button"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      恢复
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handlePermanentDelete(post.id, "posts")}
                      loading={acting === post.id}
                      data-testid="permanent-delete-button"
                    >
                      <Trash2 size={14} className="mr-1" />
                      永久删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : accounts.length === 0 ? (
        <EmptyState message="回收站是空的" hint="删除的账号会出现在这里" />
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              data-testid="trash-account-item"
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs">
                      {account.platform?.name || "Twitter"}
                    </span>
                    <span>
                      删除于 {new Date(account.deletedAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {account.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    @{account.handle}
                  </p>
                  {account.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {account.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(account.id, "accounts")}
                    loading={acting === account.id}
                    data-testid="restore-button"
                  >
                    <RotateCcw size={14} className="mr-1" />
                    恢复
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handlePermanentDelete(account.id, "accounts")}
                    loading={acting === account.id}
                    data-testid="permanent-delete-button"
                  >
                    <Trash2 size={14} className="mr-1" />
                    永久删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* 分页 */}
      {tab === "posts" && totalPosts > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalPosts}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
      {tab === "accounts" && totalAccounts > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalAccounts}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
      {/* 提示 */}
      {(posts.length > 0 || accounts.length > 0) && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">永久删除不可恢复</p>
            <p className="text-xs mt-0.5">
              永久删除会从数据库彻底删除记录，并清理关联的媒体文件。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      data-testid="empty-state"
      className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700"
    >
      <Inbox size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-gray-900 dark:text-white font-medium">{message}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
