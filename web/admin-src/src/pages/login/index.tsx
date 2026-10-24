import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input } from 'antd'
import {
  AppstoreOutlined,
  LockOutlined,
  MailOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError, get } from '../../api/client'
import type { CaptchaChallenge } from '../../api/types'
import BrandMark from '../../components/BrandMark'

const REMEMBER_KEY = 'seamcap.admin.remember'

interface SavedLogin {
  username: string
  remember: boolean
}

function readSavedLogin(): SavedLogin {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return { username: '', remember: false }
    const v = JSON.parse(raw) as { username?: unknown; remember?: unknown }
    return {
      username: typeof v.username === 'string' ? v.username : '',
      remember: v.remember === true,
    }
  } catch {
    return { username: '', remember: false }
  }
}

// 只保存用户名与“记住登录”开关，不保存密码。
function saveLoginChoice(username: string, remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, remember: true }))
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
  } catch {
    // 隐私模式或禁用存储时忽略
  }
}

// 登录页：薄荷绿品牌侧 + 真实帽饰摄影 + 白色表单区（会话 Cookie + CSRF 下发）
export default function Login(): JSX.Element {
  const { admin, ready, login } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [saved] = useState<SavedLogin>(readSavedLogin)

  useEffect(() => {
    if (ready && admin) navigate('/admin/', { replace: true })
  }, [ready, admin, navigate])

  const loadCaptcha = useCallback(async (): Promise<void> => {
    setCaptchaLoading(true)
    try {
      const { data } = await get<CaptchaChallenge>('/admin/captcha')
      setCaptcha(data)
      form.setFieldValue('captcha_code', '')
    } catch {
      setCaptcha(null)
      setError('验证码加载失败，请点击刷新')
    } finally {
      setCaptchaLoading(false)
    }
  }, [form])

  useEffect(() => {
    void loadCaptcha()
  }, [loadCaptcha])

  const submit = async (values: {
    username: string
    password: string
    captcha_code: string
    remember?: boolean
  }): Promise<void> => {
    if (!captcha) {
      setError('验证码已失效，请刷新后重试')
      void loadCaptcha()
      return
    }
    setLoading(true)
    setError('')
    try {
      const remember = values.remember === true
      await login(values.username, values.password, captcha.id, values.captcha_code, remember)
      saveLoginChoice(values.username, remember)
      navigate('/admin/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError('用户名或密码错误')
        else if (e.fields?.captcha_code) setError('验证码错误或已过期，请重新输入')
        else setError(e.message)
      } else {
        setError('网络错误，请重试')
      }
      void loadCaptcha()
    } finally {
      setLoading(false)
    }
  }

  if (ready && admin) return <Navigate to="/admin/" replace />

  return (
    <div className="sc-login">
      <aside className="sc-login__visual" aria-label="SeamCap 产品与工作台介绍">
        <div className="sc-login__visual-inner">
          <div className="sc-login__brand">
            <BrandMark className="sc-login__mark" size={34} />
            <div>
              <div className="sc-login__brand-name">SeamCap</div>
              <div className="sc-login__brand-sub">Admin Console</div>
            </div>
          </div>

          <div className="sc-login__copy">
            <span className="sc-login__kicker">Yiwu · Seamless Headwear</span>
            <h1 className="sc-login__headline">
              让每一顶帽子，
              <br />
              都被清晰地管理。
            </h1>
            <p className="sc-login__lede">
              产品目录、工艺素材与客户询价，在一个工作台内保持同步。
            </p>
          </div>

          <div className="sc-login__photo">
            <img src="/static/img/cap-image-01.png" alt="SeamCap 无缝帽产品实拍" />
            <span className="sc-login__photo-tag">Seamless Caps · Factory Direct</span>
          </div>

          <ul className="sc-login__features">
            <li>
              <span className="sc-login__feature-icon" aria-hidden="true">
                <AppstoreOutlined />
              </span>
              <span>
                <strong>产品与分类</strong>
                <em>图片、SKU 与发布状态</em>
              </span>
            </li>
            <li>
              <span className="sc-login__feature-icon" aria-hidden="true">
                <PictureOutlined />
              </span>
              <span>
                <strong>媒体与工艺</strong>
                <em>素材引用与内容发布</em>
              </span>
            </li>
            <li>
              <span className="sc-login__feature-icon" aria-hidden="true">
                <MailOutlined />
              </span>
              <span>
                <strong>客户询价</strong>
                <em>线索跟进与事件记录</em>
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="sc-login__panel">
        <div className="sc-login__card">
          <div className="sc-login__mobile-brand">
            <BrandMark size={32} />
            <span>
              <strong>SeamCap</strong>
              <em>Admin Console</em>
            </span>
          </div>

          <span className="sc-login__panel-kicker">Admin Login</span>
          <h2 className="sc-login__title">登录管理后台</h2>
          <p className="sc-login__subtitle">
            使用管理员账号继续，管理产品、内容与客户询价。
          </p>

          <div className="sc-login__alert">
            {error && <Alert type="error" showIcon message={error} />}
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(v) => void submit(v)}
            initialValues={{ username: saved.username, remember: saved.remember }}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="sc-muted" />}
                placeholder="用户名"
                size="large"
                autoFocus
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="sc-muted" />}
                placeholder="密码"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item
              label="验证码"
              required
              extra="看不清？点击图片刷新，验证码 5 分钟内有效"
            >
              <div className="sc-captcha-row">
                <Form.Item
                  name="captcha_code"
                  noStyle
                  rules={[{ required: true, message: '请输入验证码' }]}
                >
                  <Input
                    prefix={<SafetyCertificateOutlined className="sc-muted" />}
                    placeholder="图中 4 位数字"
                    size="large"
                    maxLength={4}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </Form.Item>
                <button
                  type="button"
                  className="sc-captcha-btn"
                  onClick={() => void loadCaptcha()}
                  title="点击刷新验证码"
                  aria-label="刷新验证码"
                >
                  {captcha ? (
                    <img src={captcha.image} alt="图形验证码" />
                  ) : (
                    <span>{captchaLoading ? '加载中…' : '刷新'}</span>
                  )}
                </button>
              </div>
            </Form.Item>
            <Form.Item name="remember" valuePropName="checked" className="sc-login__remember">
              <Checkbox>
                记住登录 30 天
                <span className="sc-login__remember-hint">（不会保存密码）</span>
              </Checkbox>
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={!captcha}
              className="sc-login__submit"
            >
              登录
            </Button>
          </Form>

          <p className="sc-login__hint">
            <LockOutlined />
            连续失败 5 次将锁定 5 分钟（IP 与账号分别计数）· 验证码一次性使用
          </p>
        </div>
        <p className="sc-login__copyright">SeamCap · Yiwu Shirun Headwear</p>
      </main>
    </div>
  )
}
