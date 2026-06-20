import { create } from "zustand";
import {
  COOKIE_FILTER_ACCOUNTS,
  COOKIE_FILTER_PLATFORMS,
  COOKIE_FILTER_STATUS,
  COOKIE_FILTER_SORT_FIELD,
  COOKIE_FILTER_SORT_ORDER,
} from "@/lib/config";

export type SortField = "scheduledTime" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

interface FilterState {
  selectedAccounts: string[];
  selectedPlatforms: string[];
  statusFilter: string;
  sortField: SortField;
  sortOrder: SortOrder;
  setSelectedAccounts: (accounts: string[]) => void;
  setSelectedPlatforms: (platforms: string[]) => void;
  setStatusFilter: (status: string) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSort: (field: SortField) => void;
  toggleAccount: (accountId: string) => void;
  togglePlatform: (platformId: string) => void;
  clearAll: () => void;
  rehydrate: () => void; // 用于从 cookie 重新读取状态
}

// 从 cookie 获取初始值
function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// 设置 cookie
function setCookie(name: string, value: string, days: number = 30) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// 删除 cookie（将过期时间设为过去时间，浏览器自动清除）
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
}

// 解析 cookie 中的数组
function parseArrayCookie(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}


// 创建 store，使用 getter 函数延迟读取 cookie
export const useFilterStore = create<FilterState>((set, get) => ({
  // 初始值为空数组，组件挂载后会通过 rehydrate 从 cookie 恢复
  selectedAccounts: [],
  selectedPlatforms: [],
  statusFilter: "all",
  sortField: "scheduledTime",
  sortOrder: "desc",

  rehydrate: () => {
    set({
      selectedAccounts: parseArrayCookie(getCookieValue(COOKIE_FILTER_ACCOUNTS)),
      selectedPlatforms: parseArrayCookie(getCookieValue(COOKIE_FILTER_PLATFORMS)),
      statusFilter: getCookieValue(COOKIE_FILTER_STATUS) || "all",
      sortField: (getCookieValue(COOKIE_FILTER_SORT_FIELD) as SortField) || "scheduledTime",
      sortOrder: (getCookieValue(COOKIE_FILTER_SORT_ORDER) as SortOrder) || "desc",
    });
  },

  setSelectedAccounts: (accounts) => {
    setCookie(COOKIE_FILTER_ACCOUNTS, JSON.stringify(accounts));
    set({ selectedAccounts: accounts });
  },

  setSelectedPlatforms: (platforms) => {
    setCookie(COOKIE_FILTER_PLATFORMS, JSON.stringify(platforms));
    set({ selectedPlatforms: platforms });
  },

  setStatusFilter: (status) => {
    setCookie(COOKIE_FILTER_STATUS, status);
    set({ statusFilter: status });
  },

  setSortField: (field) => {
    setCookie(COOKIE_FILTER_SORT_FIELD, field);
    set({ sortField: field });
  },

  setSortOrder: (order) => {
    setCookie(COOKIE_FILTER_SORT_ORDER, order);
    set({ sortOrder: order });
  },

  toggleSort: (field) => {
    const { sortField, sortOrder } = get();
    if (sortField === field) {
      // 同一字段，切换排序方向
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      setCookie(COOKIE_FILTER_SORT_ORDER, newOrder);
      set({ sortOrder: newOrder });
    } else {
      // 新字段，默认降序
      setCookie(COOKIE_FILTER_SORT_FIELD, field);
      setCookie(COOKIE_FILTER_SORT_ORDER, "desc");
      set({ sortField: field, sortOrder: "desc" });
    }
  },

  toggleAccount: (accountId) => {
    const { selectedAccounts } = get();
    const newAccounts = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    setCookie(COOKIE_FILTER_ACCOUNTS, JSON.stringify(newAccounts));
    set({ selectedAccounts: newAccounts });
  },

  togglePlatform: (platformId) => {
    const { selectedPlatforms } = get();
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(id => id !== platformId)
      : [...selectedPlatforms, platformId];
    setCookie(COOKIE_FILTER_PLATFORMS, JSON.stringify(newPlatforms));
    set({ selectedPlatforms: newPlatforms });
  },

  clearAll: () => {
    // 真正删除 cookie，而非写入 "[]"（旧值会残留导致下次打开仍有筛选）
    deleteCookie(COOKIE_FILTER_ACCOUNTS);
    deleteCookie(COOKIE_FILTER_PLATFORMS);
    deleteCookie(COOKIE_FILTER_STATUS);
    set({
      selectedAccounts: [],
      selectedPlatforms: [],
      statusFilter: "all"
    });
  },
}));
