"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Avatar, Button, Card, Col, Divider, Flex, Form, Input, InputNumber, Modal, Row, Select, Space, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import type { AdminUser } from "@/services/api/admin";
import { useAdminUsers } from "./use-admin-users";

type UserFormValues = Partial<AdminUser> & { password?: string };

const roleOptions = [
    { label: "普通用户", value: "user" },
    { label: "管理员", value: "admin" },
];

const statusOptions = [
    { label: "正常", value: "active" },
    { label: "禁用", value: "ban" },
];

export default function AdminUsersPage() {
    const { users, keyword, page, pageSize, total, isLoading, searchUsers, changePage, changePageSize, resetFilters, refreshUsers, saveUser: saveAdminUser, adjustCredits, deleteUser } = useAdminUsers();
    const [form] = Form.useForm<UserFormValues>();
    const [keywordText, setKeywordText] = useState(keyword);
    const [editingUser, setEditingUser] = useState<Partial<AdminUser> | null>(null);
    const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

    useEffect(() => setKeywordText(keyword), [keyword]);

    useEffect(() => {
        if (editingUser) form.setFieldsValue({ role: "user", status: "active", ...editingUser, password: "" });
    }, [editingUser, form]);

    const saveUser = async () => {
        const value = await form.validateFields();
        const userValue = { ...value };
        delete userValue.credits;
        await saveAdminUser({ ...editingUser, ...userValue, password: value.password || undefined });
        setEditingUser(null);
    };

    const saveCredits = async () => {
        if (!editingUser?.id) return;
        await adjustCredits(editingUser.id, form.getFieldValue("credits") || 0);
    };

    const columns: ProColumns<AdminUser>[] = [
        {
            title: "用户",
            dataIndex: "username",
            width: 260,
            render: (_, item) => (
                <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                    <Avatar src={item.avatarUrl || undefined}>{(item.displayName || item.username || "U").slice(0, 1).toUpperCase()}</Avatar>
                    <Flex vertical style={{ minWidth: 0 }}>
                        <Typography.Text strong ellipsis>
                            {item.displayName || item.username}
                        </Typography.Text>
                        <Typography.Text type="secondary" ellipsis>
                            {item.username}
                        </Typography.Text>
                    </Flex>
                </Flex>
            ),
        },
        {
            title: "角色",
            dataIndex: "role",
            width: 100,
            render: (_, item) => <Tag color={item.role === "admin" ? "gold" : "default"}>{item.role === "admin" ? "管理员" : "用户"}</Tag>,
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 90,
            render: (_, item) => <Tag color={item.status === "ban" ? "red" : "green"}>{item.status === "ban" ? "禁用" : "正常"}</Tag>,
        },
        {
            title: "算力点",
            dataIndex: "credits",
            width: 100,
            render: (_, item) => <Typography.Text>{item.credits}</Typography.Text>,
        },
        {
            title: "Linux.do",
            dataIndex: "linuxDoId",
            width: 140,
            render: (_, item) => <Typography.Text type="secondary">{item.linuxDoId || "-"}</Typography.Text>,
        },
        {
            title: "最近登录",
            dataIndex: "lastLoginAt",
            width: 180,
            render: (_, item) => <Typography.Text type="secondary">{item.lastLoginAt ? dayjs(item.lastLoginAt).format("YYYY-MM-DD HH:mm:ss") : "-"}</Typography.Text>,
        },
        {
            title: "操作",
            key: "actions",
            width: 96,
            align: "right",
            fixed: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Tooltip title="编辑">
                        <Button aria-label="编辑用户" type="text" size="small" className="!h-7 !w-7 !min-w-7 !p-0" icon={<EditOutlined />} onClick={() => setEditingUser(item)} />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button aria-label="删除用户" danger type="text" size="small" className="!h-7 !w-7 !min-w-7 !p-0" icon={<DeleteOutlined />} onClick={() => setDeletingUser(item)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless" className="sacred-panel-soft sacred-admin-filter-card">
                    <Form layout="vertical">
                        <Row gutter={16} align="bottom">
                            <Col flex="360px">
                                <Form.Item label="关键词">
                                    <Input.Search
                                        value={keywordText}
                                        placeholder="搜索用户名、昵称、邮箱或 Linux.do ID"
                                        allowClear
                                        enterButton={<SearchOutlined />}
                                        onSearch={() => searchUsers(keywordText)}
                                        onChange={(event) => setKeywordText(event.target.value)}
                                    />
                                </Form.Item>
                            </Col>
                            <Col flex="none">
                                <Form.Item>
                                    <Space>
                                        <Button
                                            onClick={() => {
                                                setKeywordText("");
                                                resetFilters();
                                            }}
                                        >
                                            重置
                                        </Button>
                                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => searchUsers(keywordText)}>
                                            查询
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
                <ProTable<AdminUser>
                    rowKey="id"
                    columns={columns}
                    dataSource={users}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    scroll={{ x: 980 }}
                    cardProps={{ variant: "borderless", className: "sacred-panel-soft" }}
                    headerTitle={
                        <Space>
                            <Typography.Text strong>用户列表</Typography.Text>
                            <Tag>{total} 人</Tag>
                        </Space>
                    }
                    options={{ density: true, setting: true, reload: () => void refreshUsers() }}
                    toolBarRender={() => [
                        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => setEditingUser({ role: "user", status: "active" })}>
                            新增
                        </Button>,
                    ]}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 人`,
                        onChange: (nextPage, nextPageSize) => (nextPageSize !== pageSize ? changePageSize(nextPageSize) : changePage(nextPage)),
                    }}
                />
            </Flex>

            <Modal
                className="sacred-admin-editor-modal"
                title={
                    <Flex vertical gap={4}>
                        <span className="sacred-label">USER ACCESS</span>
                        <Typography.Title level={4} className="sacred-title !m-0">
                            {editingUser?.id ? "编辑用户" : "新增用户"}
                        </Typography.Title>
                        <Typography.Text className="sacred-muted">账号身份、状态与算力点信息</Typography.Text>
                    </Flex>
                }
                open={Boolean(editingUser)}
                width={680}
                onCancel={() => setEditingUser(null)}
                footer={
                    <div className="sacred-admin-editor-actions">
                        <Button autoInsertSpace={false} onClick={() => setEditingUser(null)}>
                            取消
                        </Button>
                        <Button type="primary" autoInsertSpace={false} onClick={() => void saveUser()}>
                            保存
                        </Button>
                    </div>
                }
                destroyOnHidden
            >
                <div className="sacred-admin-editor-body">
                    <Form form={form} layout="vertical" requiredMark={false}>
                        <Typography.Text strong className="sacred-admin-section-title">
                            基础信息
                        </Typography.Text>
                        <Row gutter={14}>
                            <Col xs={24} md={12}>
                                <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="password" label={editingUser?.id ? "新密码" : "密码"} rules={editingUser?.id ? [] : [{ required: true, message: "请输入密码" }]}>
                                    <Input.Password autoComplete="new-password" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="displayName" label="昵称">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="email" label="邮箱">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
                                    <Select options={roleOptions} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                                    <Select options={statusOptions} />
                                </Form.Item>
                            </Col>
                        </Row>
                        {editingUser?.id ? (
                            <>
                                <Divider style={{ margin: "4px 0 16px" }} />
                                <Typography.Text strong className="sacred-admin-section-title">
                                    算力点调整
                                </Typography.Text>
                                <Row gutter={14}>
                                    <Col xs={24} md={12}>
                                        <Form.Item label="算力点">
                                            <Space.Compact style={{ width: "100%" }}>
                                                <Form.Item name="credits" noStyle>
                                                    <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                                                </Form.Item>
                                                <Button autoInsertSpace={false} onClick={() => void saveCredits()}>
                                                    调整
                                                </Button>
                                            </Space.Compact>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </>
                        ) : null}
                    </Form>
                </div>
            </Modal>

            <Modal
                className="sacred-admin-delete-modal"
                title={
                    <Flex vertical gap={4}>
                        <span className="sacred-label">DELETE USER</span>
                        <Typography.Title level={4} className="sacred-title !m-0">
                            删除用户
                        </Typography.Title>
                    </Flex>
                }
                open={Boolean(deletingUser)}
                onCancel={() => setDeletingUser(null)}
                footer={
                    <div className="sacred-admin-delete-actions">
                        <Button autoInsertSpace={false} onClick={() => setDeletingUser(null)}>
                            取消
                        </Button>
                        <Button
                            danger
                            type="primary"
                            autoInsertSpace={false}
                            onClick={async () => {
                                if (!deletingUser) return;
                                await deleteUser(deletingUser.id);
                                setDeletingUser(null);
                            }}
                        >
                            删除
                        </Button>
                    </div>
                }
            >
                <div className="sacred-admin-delete-body">确定删除「{deletingUser?.displayName || deletingUser?.username}」吗？删除后该账号将无法继续登录。</div>
            </Modal>
        </main>
    );
}
