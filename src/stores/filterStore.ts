import { create } from "zustand";

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

// 解析 cookie 中的数组
function parseArrayCookie(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

const ACCOUNT_COOKIE = "np_filter_accounts";
const PLATFORM_COOKIE = "np_filter_platforms";
const STATUS_COOKIE = "np_filter_status";
const SORT_FIELD_COOKIE = "np_filter_sort_field";
const SORT_ORDER_COOKIE = "np_filter_sort_order";

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
      selectedAccounts: parseArrayCookie(getCookieValue(ACCOUNT_COOKIE)),
      selectedPlatforms: parseArrayCookie(getCookieValue(PLATFORM_COOKIE)),
      statusFilter: getCookieValue(STATUS_COOKIE) || "all",
      sortField: (getCookieValue(SORT_FIELD_COOKIE) as SortField) || "scheduledTime",
      sortOrder: (getCookieValue(SORT_ORDER_COOKIE) as SortOrder) || "desc",
    });
  },

  setSelectedAccounts: (accounts) => {
    setCookie(ACCOUNT_COOKIE, JSON.stringify(accounts));
    set({ selectedAccounts: accounts });
  },

  setSelectedPlatforms: (platforms) => {
    setCookie(PLATFORM_COOKIE, JSON.stringify(platforms));
    set({ selectedPlatforms: platforms });
  },

  setStatusFilter: (status) => {
    setCookie(STATUS_COOKIE, status);
    set({ statusFilter: status });
  },

  setSortField: (field) => {
    setCookie(SORT_FIELD_COOKIE, field);
    set({ sortField: field });
  },

  setSortOrder: (order) => {
    setCookie(SORT_ORDER_COOKIE, order);
    set({ sortOrder: order });
  },

  toggleSort: (field) => {
    const { sortField, sortOrder } = get();
    if (sortField === field) {
      // 同一字段，切换排序方向
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      setCookie(SORT_ORDER_COOKIE, newOrder);
      set({ sortOrder: newOrder });
    } else {
      // 新字段，默认降序
      setCookie(SORT_FIELD_COOKIE, field);
      setCookie(SORT_ORDER_COOKIE, "desc");
      set({ sortField: field, sortOrder: "desc" });
    }
  },

  toggleAccount: (accountId) => {
    const { selectedAccounts } = get();
    const newAccounts = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    setCookie(ACCOUNT_COOKIE, JSON.stringify(newAccounts));
    set({ selectedAccounts: newAccounts });
  },

  togglePlatform: (platformId) => {
    const { selectedPlatforms } = get();
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(id => id !== platformId)
      : [...selectedPlatforms, platformId];
    setCookie(PLATFORM_COOKIE, JSON.stringify(newPlatforms));
    set({ selectedPlatforms: newPlatforms });
  },

  clearAll: () => {
    setCookie(ACCOUNT_COOKIE, "[]");
    setCookie(PLATFORM_COOKIE, "[]");
    setCookie(STATUS_COOKIE, "all");
    set({
      selectedAccounts: [],
      selectedPlatforms: [],
      statusFilter: "all"
    });
  },
}));
