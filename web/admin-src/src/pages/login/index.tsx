import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/client'

// 登录页（会话 Cookie + CSRF 下发）
export default function Login(): JSX.Element {
  const { admin, ready, login } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ready && admin) navigate('/admin/', { replace: true })
  }, [ready, admin, navigate])

  const submit = async (values: { username: string; password: string }): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      await login(values.username, values.password)
      navigate('/admin/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError('用户名或密码错误')
        else setError(e.message)
      } else {
        setError('网络错误，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  if (ready && admin) return <Navigate to="/admin/" replace />

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F6F7F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#0F172A',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            SC
          </span>
          <Typography.Title level={4} style={{ margin: '12px 0 0', color: '#0F172A' }}>
            SeamCap 管理后台
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            义乌无痕棒球帽源头工厂
          </Typography.Text>
        </div>
        {error && (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        )}
        <Form form={form} layout="vertical" onFinish={(v) => void submit(v)} requiredMark={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登 录
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          连续失败 5 次将锁定 5 分钟（IP 与账号分别计数）
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
