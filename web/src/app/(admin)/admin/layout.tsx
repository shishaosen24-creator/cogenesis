"use client";

import { FileTextOutlined, HomeOutlined, LogoutOutlined, PictureOutlined, SettingOutlined, TransactionOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Flex, Layout, Menu, Typography, theme } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { adminLayoutStyle } from "@/lib/app-theme";
import { useUserStore } from "@/stores/use-user-store";

const adminMenus = [
    { key: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
    { key: "/admin/credit-logs", icon: <TransactionOutlined />, label: "算力点日志" },
    { key: "/admin/prompts", icon: <FileTextOutlined />, label: "提示词管理" },
    { key: "/admin/assets", icon: <PictureOutlined />, label: "素材库" },
    { key: "/admin/settings", icon: <SettingOutlined />, label: "系统设置" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { token: antToken } = theme.useToken();
    const router = useRouter();
    const pathname = usePathname();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const logout = useUserStore((state) => state.clearSession);
    const activeKey = pathname.startsWith("/admin/settings")
        ? "/admin/settings"
        : pathname.startsWith("/admin/assets")
          ? "/admin/assets"
          : pathname.startsWith("/admin/prompts")
            ? "/admin/prompts"
            : pathname.startsWith("/admin/credit-logs")
              ? "/admin/credit-logs"
              : pathname.startsWith("/admin/users")
                ? "/admin/users"
                : "";
    const pageTitle = pathname.startsWith("/admin/settings") ? "系统设置" : pathname.startsWith("/admin/assets") ? "素材库管理" : pathname.startsWith("/admin/prompts") ? "提示词管理" : pathname.startsWith("/admin/credit-logs") ? "算力点日志" : "用户管理";

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace("/login?redirect=/admin");
            return;
        }
        if (user?.role !== "admin") {
            router.replace("/");
        }
    }, [isReady, router, token, user?.role]);

    if (!isReady || !token || user?.role !== "admin") {
        const title = !isReady ? "正在读取登录状态" : !token ? "正在前往登录" : "正在返回首页";
        const description = !isReady ? "请稍候，系统正在确认当前账户。" : !token ? "管理后台需要登录后访问。" : "当前账户没有管理权限。";
        return (
            <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "rgba(9,10,10,.88)", color: antToken.colorText, padding: 24 }}>
                <div style={{ width: "min(420px, 100%)", border: `1px solid ${antToken.colorBorder}`, borderRadius: 8, background: "rgba(18,20,19,.78)", padding: 24, textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,.35)", backdropFilter: "blur(18px)" }}>
                    <img src="/brand/site-logo-transparent.png" alt="CoGenesis" style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 16, filter: "drop-shadow(0 0 18px rgba(197,160,89,.38))" }} />
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        {title}
                    </Typography.Title>
                    <Typography.Paragraph style={{ margin: "10px 0 0", color: antToken.colorTextSecondary }}>{description}</Typography.Paragraph>
                </div>
            </div>
        );
    }

    return (
        <Layout hasSider className="sacred-admin-layout" style={{ height: "100vh", overflow: "hidden", background: "transparent" }}>
            <Layout.Sider className="sacred-admin-sider" width={adminLayoutStyle.siderWidth} style={{ height: "100vh", overflow: "hidden", background: "rgba(18,20,19,.88)", borderRight: `1px solid ${antToken.colorBorder}`, backdropFilter: "blur(18px)" }}>
                <Flex align="center" gap={12} style={{ height: adminLayoutStyle.brandHeight, padding: "0 20px", borderBottom: `1px solid ${antToken.colorBorderSecondary}` }}>
                    <img src="/brand/site-logo-transparent.png" alt="CoGenesis" style={{ width: 36, height: 36, objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(197,160,89,.32))" }} />
                    <Typography.Text strong className="sacred-admin-brand-text" style={{ fontSize: 18, letterSpacing: 0 }}>
                        CoGenesis
                    </Typography.Text>
                </Flex>
                <Menu
                    mode="inline"
                    selectedKeys={[activeKey]}
                    style={adminLayoutStyle.menu}
                    items={adminMenus.map((item) => ({
                        ...item,
                        label: (
                            <Link href={item.key} style={{ color: "inherit" }}>
                                {item.label}
                            </Link>
                        ),
                        style: adminLayoutStyle.menuItem,
                    }))}
                />
                <Flex className="sacred-admin-side-actions" vertical gap={8} style={{ position: "absolute", bottom: 0, insetInline: 0, padding: 12, borderTop: `1px solid ${antToken.colorBorder}`, background: "rgba(18,20,19,.92)" }}>
                    <Button block icon={<HomeOutlined />} href="/canvas" target="_blank" rel="noreferrer">
                        前往画布
                    </Button>
                    <Button block icon={<LogoutOutlined />} onClick={logout}>
                        退出登录
                    </Button>
                </Flex>
            </Layout.Sider>
            <Layout style={{ background: "rgba(18,20,19,.62)", backdropFilter: "blur(8px)" }}>
                <Layout.Header
                    className="sacred-admin-header"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: adminLayoutStyle.headerHeight, padding: "0 24px", background: "rgba(30,32,31,.82)", borderBottom: `1px solid ${antToken.colorBorder}`, backdropFilter: "blur(18px)" }}
                >
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        {pageTitle}
                    </Typography.Title>
                    <Flex align="center" gap={4}>
                        <UserStatusActions showConfig={false} />
                    </Flex>
                </Layout.Header>
                <Layout.Content className="sacred-admin-content" style={{ minHeight: 0, overflow: "auto", background: "rgba(18,20,19,.5)" }}>{children}</Layout.Content>
            </Layout>
        </Layout>
    );
}
