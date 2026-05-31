"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, FileText, TrendingUp, Clock, Plus, ArrowRight } from "lucide-react";

interface Stats {
  totalPosts: number;
  scheduled: number;
  published: number;
  drafts: number;
}

interface RecentPost {
  id: string;
  content: string;
  scheduledTime: string | null;
  status: string;
  account: { name: string; handle: string };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats>({ totalPosts: 0, scheduled: 0, published: 0, drafts: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }

    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, postsRes] = await Promise.all([
        fetch("/api/posts/stats"),
        fetch("/api/posts?limit=5"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setRecentPosts(postsData.posts || []);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: "本周计划", value: stats.scheduled, icon: Calendar, color: "blue" },
    { label: "已发布", value: stats.published, icon: TrendingUp, color: "green" },
    { label: "草稿", value: stats.drafts, icon: FileText, color: "yellow" },
    { label: "总计", value: stats.totalPosts, icon: Clock, color: "purple" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            欢迎回来，{session?.user?.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            这里是你的发布计划概览
          </p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          新建帖子
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}>
                  <Icon className={`text-${stat.color}-600 dark:text-${stat.color}-400`} size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/calendar"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">日历视图</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">查看和管理你的发布计划</p>
              </div>
            </div>
            <ArrowRight className="text-gray-400 group-hover:text-blue-600 transition-colors" size={20} />
          </div>
        </Link>

        <Link
          href="/accounts"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FileText className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">管理账号</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">添加和管理社交媒体账号</p>
              </div>
            </div>
            <ArrowRight className="text-gray-400 group-hover:text-green-600 transition-colors" size={20} />
          </div>
        </Link>
      </div>

      {/* Recent Posts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">近期计划</h2>
          <Link href="/posts" className="text-sm text-blue-600 hover:text-blue-700">
            查看全部
          </Link>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentPosts.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              暂无发布计划，<Link href="/posts/new" className="text-blue-600 hover:underline">创建一个</Link>
            </div>
          ) : (
            recentPosts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                      {post.content || "无内容"}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>@{post.account?.handle || "未知账号"}</span>
                      {post.scheduledTime && (
                        <span>{new Date(post.scheduledTime).toLocaleString("zh-CN")}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      post.status === "published"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : post.status === "scheduled"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {post.status === "published" ? "已发布" : post.status === "scheduled" ? "已计划" : "草稿"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}