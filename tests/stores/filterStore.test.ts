import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// 创建简单的 cookie 存储
const cookieStore: Record<string, string> = {};

const mockDocument = {
  get cookie() {
    return Object.entries(cookieStore)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("; ");
  },
  set cookie(value: string) {
    const [nameValue] = value.split(";");
    const [name, ...rest] = nameValue.split("=");
    const val = rest.join("=");
    if (val === undefined || val === "") {
      delete cookieStore[name];
    } else {
      cookieStore[name] = decodeURIComponent(val);
    }
  },
};

// 模拟 document
Object.defineProperty(global, "document", {
  value: mockDocument,
  writable: true,
});

// Helper to clear cookies between tests
function clearCookies() {
  Object.keys(cookieStore).forEach((key) => delete cookieStore[key]);
}

// 重置模块状态
function resetModuleState() {
  vi.resetModules();
}

describe("useFilterStore", () => {
  beforeEach(() => {
    clearCookies();
    resetModuleState();
  });

  it("should initialize with empty arrays when no cookies exist", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    // 调用 rehydrate 以确保从 cookie 读取初始状态
    useFilterStore.getState().rehydrate();
    const store = useFilterStore.getState();
    
    expect(store.selectedAccounts).toEqual([]);
    expect(store.selectedPlatforms).toEqual([]);
    expect(store.statusFilter).toBe("all");
  });

  it("should toggle account selection", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().toggleAccount("account-1");
    let state = useFilterStore.getState();
    expect(state.selectedAccounts).toContain("account-1");
    
    useFilterStore.getState().toggleAccount("account-2");
    state = useFilterStore.getState();
    expect(state.selectedAccounts).toContain("account-1");
    expect(state.selectedAccounts).toContain("account-2");
    
    useFilterStore.getState().toggleAccount("account-1");
    state = useFilterStore.getState();
    expect(state.selectedAccounts).not.toContain("account-1");
    expect(state.selectedAccounts).toContain("account-2");
  });

  it("should toggle platform selection", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().togglePlatform("twitter");
    let state = useFilterStore.getState();
    expect(state.selectedPlatforms).toContain("twitter");
    
    useFilterStore.getState().togglePlatform("instagram");
    state = useFilterStore.getState();
    expect(state.selectedPlatforms).toContain("twitter");
    expect(state.selectedPlatforms).toContain("instagram");
    
    useFilterStore.getState().togglePlatform("twitter");
    state = useFilterStore.getState();
    expect(state.selectedPlatforms).not.toContain("twitter");
    expect(state.selectedPlatforms).toContain("instagram");
  });

  it("should set and persist accounts to cookie", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSelectedAccounts(["acc-1", "acc-2"]);
    
    expect(cookieStore["np_filter_accounts"]).toBe(
      JSON.stringify(["acc-1", "acc-2"])
    );
  });

  it("should set and persist platforms to cookie", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSelectedPlatforms(["twitter", "facebook"]);
    
    expect(cookieStore["np_filter_platforms"]).toBe(
      JSON.stringify(["twitter", "facebook"])
    );
  });

  it("should set and persist status filter to cookie", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setStatusFilter("draft");
    
    expect(cookieStore["np_filter_status"]).toBe("draft");
  });

  it("should clear all filters", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSelectedAccounts(["acc-1"]);
    useFilterStore.getState().setSelectedPlatforms(["twitter"]);
    useFilterStore.getState().setStatusFilter("draft");
    
    useFilterStore.getState().clearAll();
    
    const state = useFilterStore.getState();
    expect(state.selectedAccounts).toEqual([]);
    expect(state.selectedPlatforms).toEqual([]);
    expect(state.statusFilter).toBe("all");
  });

  it("should read accounts from existing cookie on initialization", async () => {
    // Pre-populate cookie
    cookieStore["np_filter_accounts"] = JSON.stringify(["cookie-acc-1", "cookie-acc-2"]);
    
    const { useFilterStore } = await import("@/stores/filterStore");
    // 手动调用 rehydrate 来读取预填充的 cookie
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.selectedAccounts).toEqual(["cookie-acc-1", "cookie-acc-2"]);
  });

  it("should read platforms from existing cookie on initialization", async () => {
    // Pre-populate cookie
    cookieStore["np_filter_platforms"] = JSON.stringify(["cookie-twitter"]);
    
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.selectedPlatforms).toEqual(["cookie-twitter"]);
  });

  it("should read status filter from existing cookie on initialization", async () => {
    // Pre-populate cookie
    cookieStore["np_filter_status"] = "scheduled";
    
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.statusFilter).toBe("scheduled");
  });

  it("should handle malformed cookie JSON gracefully", async () => {
    // Pre-populate with invalid JSON
    cookieStore["np_filter_accounts"] = "not-valid-json";
    
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.selectedAccounts).toEqual([]);
  });

  // ========== 排序功能测试 ==========

  it("should toggle sort direction for same field", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    // 默认是 scheduledTime + desc
    let state = useFilterStore.getState();
    expect(state.sortField).toBe("scheduledTime");
    expect(state.sortOrder).toBe("desc");
    
    // 切换为升序
    useFilterStore.getState().toggleSort("scheduledTime");
    state = useFilterStore.getState();
    expect(state.sortField).toBe("scheduledTime");
    expect(state.sortOrder).toBe("asc");
    
    // 再切换回降序
    useFilterStore.getState().toggleSort("scheduledTime");
    state = useFilterStore.getState();
    expect(state.sortOrder).toBe("desc");
  });

  it("should switch to different field with default desc order", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    // 默认是 scheduledTime + desc
    // 切换到 createdAt 字段
    useFilterStore.getState().toggleSort("createdAt");
    const state = useFilterStore.getState();
    expect(state.sortField).toBe("createdAt");
    expect(state.sortOrder).toBe("desc"); // 新字段默认降序
  });

  it("should set and persist sort field to cookie", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSortField("createdAt");
    
    expect(cookieStore["np_filter_sort_field"]).toBe("createdAt");
  });

  it("should set and persist sort order to cookie", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSortOrder("asc");
    
    expect(cookieStore["np_filter_sort_order"]).toBe("asc");
  });

  it("should read sort field from existing cookie on initialization", async () => {
    cookieStore["np_filter_sort_field"] = "updatedAt";
    
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.sortField).toBe("updatedAt");
  });

  it("should read sort order from existing cookie on initialization", async () => {
    cookieStore["np_filter_sort_order"] = "asc";
    
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    const state = useFilterStore.getState();
    expect(state.sortOrder).toBe("asc");
  });

  it("should persist both sort field and order together", async () => {
    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.getState().rehydrate();
    
    useFilterStore.getState().setSortField("createdAt");
    useFilterStore.getState().setSortOrder("asc");
    
    expect(cookieStore["np_filter_sort_field"]).toBe("createdAt");
    expect(cookieStore["np_filter_sort_order"]).toBe("asc");
  });
});
