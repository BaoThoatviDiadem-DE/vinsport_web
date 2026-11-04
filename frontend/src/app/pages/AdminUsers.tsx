import React, { useEffect, useMemo, useState } from "react";
import api from "../api/api";

type UserItem = {
  id: number | string;
  user_id?: number | string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: "admin" | "user";
};

type RoleFilter = "all" | "admin" | "user";

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeUser(item: any): UserItem {
  return {
    id: item?.id ?? item?.user_id,
    user_id: item?.user_id ?? item?.id,
    name: item?.name || "",
    email: item?.email || "",
    phone: item?.phone || "",
    address: item?.address || "",
    role: item?.role === "admin" ? "admin" : "user",
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const adminCount = useMemo(() => {
    return users.filter((u) => u.role === "admin").length;
  }, [users]);

  const userCount = useMemo(() => {
    return users.filter((u) => u.role === "user").length;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const loadUsers = async (email = "") => {
    try {
      setIsLoading(true);

      const query = email.trim()
        ? `/admin/users?email=${encodeURIComponent(email.trim())}`
        : "/admin/users";

      const data = await api.get(query);
      setUsers(toArray(data).map(normalizeUser));
    } catch (error) {
      console.error("Lỗi tải user:", error);
      alert("Không tải được danh sách người dùng");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleFieldChange = (
    id: number | string,
    field: keyof UserItem,
    value: string
  ) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
            ...u,
            [field]: field === "role" ? (value as "admin" | "user") : value,
          }
          : u
      )
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadUsers(searchEmail);
  };

  const handleResetSearch = async () => {
    setSearchEmail("");
    setRoleFilter("all");
    await loadUsers("");
  };

  const handleRoleFilterClick = (role: RoleFilter) => {
    setRoleFilter((prev) => (prev === role ? "all" : role));
  };

  const handleSaveUser = async (user: UserItem) => {
    try {
      setSavingId(user.id);

      await api.put(`/admin/users/${user.id}`, {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role,
      });

      alert("Cập nhật người dùng thành công");
      await loadUsers(searchEmail);
    } catch (error: any) {
      console.error("Lỗi cập nhật người dùng:", error);
      alert(error?.response?.data?.message || "Không cập nhật được người dùng");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-6 rounded-full bg-orange-500" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý người dùng
          </h1>
        </div>
        <p className="text-slate-500 text-sm mt-1 ml-4.5">
          Quản lý thông tin tài khoản, phân quyền quản trị viên và khách hàng.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col md:flex-row gap-3"
      >
        <input
          type="text"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          placeholder="Tìm kiếm theo email..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm transition-all"
        />

        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
        >
          Tìm kiếm
        </button>

        <button
          type="button"
          onClick={handleResetSearch}
          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold transition-colors cursor-pointer"
        >
          Đặt lại
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6">
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h2 className="text-xl font-bold text-slate-900">Danh sách người dùng</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                roleFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tất cả ({users.length})
            </button>

            <button
              type="button"
              onClick={() => handleRoleFilterClick("admin")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                roleFilter === "admin"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
              }`}
            >
              Admin: {adminCount}
            </button>

            <button
              type="button"
              onClick={() => handleRoleFilterClick("user")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                roleFilter === "user"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
              }`}
            >
              User: {userCount}
            </button>

            {roleFilter !== "all" && (
              <span className="text-xs text-slate-500 ml-1">
                Đang lọc: <span className="font-semibold text-slate-800">{roleFilter}</span>
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-slate-500">
            Đang tải người dùng...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Không có người dùng nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-3 border-b">ID</th>
                  <th className="p-3 border-b">Tên</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b">SĐT</th>
                  <th className="p-3 border-b">Địa chỉ</th>
                  <th className="p-3 border-b">Role</th>
                  <th className="p-3 border-b">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={String(user.id)} className="hover:bg-slate-50 align-top">
                    <td className="p-3 border-b whitespace-nowrap">{user.id}</td>

                    <td className="p-3 border-b min-w-[180px]">
                      <input
                        value={user.name}
                        onChange={(e) =>
                          handleFieldChange(user.id, "name", e.target.value)
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </td>

                    <td className="p-3 border-b min-w-[240px]">
                      <input
                        value={user.email}
                        onChange={(e) =>
                          handleFieldChange(user.id, "email", e.target.value)
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </td>

                    <td className="p-3 border-b min-w-[160px]">
                      <input
                        value={user.phone || ""}
                        onChange={(e) =>
                          handleFieldChange(user.id, "phone", e.target.value)
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </td>

                    <td className="p-3 border-b min-w-[220px]">
                      <input
                        value={user.address || ""}
                        onChange={(e) =>
                          handleFieldChange(user.id, "address", e.target.value)
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </td>

                    <td className="p-3 border-b min-w-[140px]">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleFieldChange(user.id, "role", e.target.value)
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="p-3 border-b whitespace-nowrap">
                      <button
                        onClick={() => handleSaveUser(user)}
                        disabled={savingId === user.id}
                        className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                      >
                        {savingId === user.id ? "Đang lưu..." : "Cập nhật"}
                      </button>
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